import { Client } from "@opensearch-project/opensearch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { waitForTransactionReceipt, writeContract } from "viem/actions";
import logger from "./logger";
import { config, chain, validateConfig } from "./config/config";
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  CircuitBreakerState,
  InferenceLog,
  oxs,
} from "./constants";
import {
  prometheus,
  circuitBreakerStateToMetricValue,
} from "./metrics/prometheus";
import { CheckpointManager } from "./config/opensearch-config";

// Validate configuration on module import
validateConfig();

// Helper: Format a string to bytes32 (similar to ethers.formatBytes32String)
function formatBytes32String(input: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  if (bytes.length > 32) {
    throw new Error("Input string too long to convert to bytes32");
  }
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return "0x" + Buffer.from(padded).toString("hex");
}

// Simple circuit breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;

  constructor(
    private readonly threshold: number = config.circuitBreaker.threshold,
    private readonly timeout: number = config.circuitBreaker.timeout
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has elapsed to enter HALF_OPEN
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        logger.info("Circuit breaker state changed to HALF_OPEN");
      } else {
        logger.warn("Circuit breaker is OPEN, rejecting request");
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();

      // Reset on success if HALF_OPEN
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn(
        `Circuit breaker state changed to OPEN after ${this.failures} failures`
      );
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
    logger.info("Circuit breaker reset to CLOSED state");
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}

// Create circuit breakers for external services
const opensearchCircuitBreaker = new CircuitBreaker();
const blockchainCircuitBreaker = new CircuitBreaker();

// Initialize OpenSearch client with reconnection logic
function createOpenSearchClient(): Client {
  const client = new Client({
    node: config.opensearch.endpoint,
    auth: {
      username: config.opensearch.username,
      password: config.opensearch.password,
    },
    ssl: {
      rejectUnauthorized: true,
    },
    maxRetries: config.opensearch.maxRetries,
    requestTimeout: config.opensearch.requestTimeout,
  });

  return client;
}

let client = createOpenSearchClient();

// Method to check OpenSearch health
export async function checkOpenSearchConnection(): Promise<boolean> {
  try {
    await opensearchCircuitBreaker.execute(async () => {
      const response = await client.cluster.health({});
      return response.body.status !== "red";
    });
    return true;
  } catch (error) {
    logger.error(`OpenSearch health check failed: ${error}`);
    return false;
  }
}

// Setup wallet client for blockchain transactions
const account = privateKeyToAccount(config.blockchain.signerPrivateKey as oxs);
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(config.blockchain.rpcUrlHttp),
});

export const POLL_INTERVAL_MS_NUM = config.polling.intervalMs;

// Last poll timestamp for health check
export let lastPollTimestamp: Date | null = null;

// Keep a local counter for tracking errors to use in logic
let errorCount = 0;

// Initialize the checkpoint manager with the OpenSearch client
const checkpointManager = new CheckpointManager(client);

// Keep track of processed IDs in memory to avoid duplicate processing
// due to OpenSearch indexing latency
const processedIdsCache = new Set<string>();

export async function pollLoop(shutdownFlag: {
  shuttingDown: boolean;
}): Promise<void> {
  logger.info("Starting OpenSearch polling loop...");
  prometheus.up.set(1); // Set poller as running

  // Load the last checkpoint timestamp on startup
  let lastTimestamp = await checkpointManager.loadCheckpoint();
  logger.info(`Starting from checkpoint: ${lastTimestamp || "beginning"}`);

  let batch: InferenceLog[] = [];
  let consecutiveEmptyBatches = 0;

  do {
    const cycleStart = Date.now();
    lastPollTimestamp = new Date();

    try {
      // Check for OpenSearch connection before proceeding
      const isConnected = await checkOpenSearchConnection();
      if (!isConnected) {
        logger.warn("OpenSearch connection unavailable, waiting before retry");
        await sleep(POLL_INTERVAL_MS_NUM);
        continue;
      }

      batch = await retryWithBackoff(
        () =>
          opensearchCircuitBreaker.execute(() =>
            fetchBatch(lastTimestamp, config.polling.batchSize)
          ),
        5,
        1000
      );

      if (batch.length > 0) {
        // Filter out any IDs we've already processed but OpenSearch hasn't updated yet
        batch = batch.filter((doc) => !processedIdsCache.has(doc.logId));

        if (batch.length === 0) {
          logger.debug("All fetched records were already processed in memory");
          continue;
        }

        consecutiveEmptyBatches = 0;
        // Extract wallet addresses and log ids from each document
        const wallets: string[] = [];
        const logIds: string[] = [];
        const batchProcessedIds: string[] = [];

        batch.forEach((doc) => {
          if (doc.walletAddress && doc.logId) {
            wallets.push(doc.walletAddress);
            // Convert logId to bytes32
            let formattedLogId: string;
            if (doc.logId.startsWith("0x") && doc.logId.length === 66) {
              formattedLogId = doc.logId;
            } else {
              formattedLogId = formatBytes32String(doc.logId);
            }
            logIds.push(formattedLogId);
            batchProcessedIds.push(doc.logId);
          } else {
            logger.warn(
              `Document missing walletAddress or logId: ${JSON.stringify(doc)}`
            );
          }
        });

        if (wallets.length > 0 && logIds.length > 0) {
          try {
            await blockchainCircuitBreaker.execute(() =>
              callContractBatch(wallets, logIds)
            );

            // Mark documents as processed after successful submission
            await opensearchCircuitBreaker.execute(() =>
              markAsProcessed(batchProcessedIds)
            );

            // Add to our in-memory processed set
            batch.forEach((doc) => {
              if (doc.logId) {
                processedIdsCache.add(doc.logId);
              }
            });

            // Update Prometheus metrics
            prometheus.recordsProcessed.inc(wallets.length);
            prometheus.batchesProcessed.inc();

            // Update lastTimestamp from the last item in batch for next query
            if (batch[batch.length - 1]["@timestamp"]) {
              lastTimestamp = batch[batch.length - 1]["@timestamp"] ?? null;

              // Save the checkpoint to disk
              if (lastTimestamp) {
                await checkpointManager.saveCheckpoint(lastTimestamp);
              }
            }
          } catch (error: any) {
            prometheus.errors.inc();
            logger.error(`Failed to process batch: ${error.message}`);
          }
        } else {
          logger.warn("No valid wallet addresses or log ids found in batch.");
        }
      } else {
        consecutiveEmptyBatches++;
        if (consecutiveEmptyBatches >= 5) {
          // If we've gotten several empty batches in a row, wait longer
          // to avoid excessive polling when there's no data
          logger.info("Multiple empty batches received, increasing wait time");
          await sleep(POLL_INTERVAL_MS_NUM * 2);
          consecutiveEmptyBatches = 0;
          continue;
        }
      }

      // Update circuit breaker state Prometheus metrics
      prometheus.opensearchCircuitBreaker.set(
        circuitBreakerStateToMetricValue(opensearchCircuitBreaker.getState())
      );
      prometheus.blockchainCircuitBreaker.set(
        circuitBreakerStateToMetricValue(blockchainCircuitBreaker.getState())
      );
    } catch (error: any) {
      prometheus.errors.inc();
      errorCount++; // Increment our local counter
      logger.error(`Polling cycle failed: ${error.message}`);

      // If we have consistent failures with OpenSearch, try to recreate the client
      if (errorCount % 5 === 0) {
        logger.info("Attempting to recreate OpenSearch client");
        try {
          client = createOpenSearchClient();
        } catch (err) {
          logger.error("Failed to recreate OpenSearch client");
        }
      }
    }

    const elapsed = Date.now() - cycleStart;

    // Record processing duration in Prometheus (convert ms to seconds)
    prometheus.processingDuration.observe(elapsed / 1000);

    const waitTime = Math.max(0, POLL_INTERVAL_MS_NUM - elapsed);
    logger.info(`Waiting ${waitTime}ms before next polling cycle...`);
    await sleep(waitTime);
  } while (
    !shutdownFlag.shuttingDown &&
    (batch.length > 0 || consecutiveEmptyBatches < 10)
  );

  // Final checkpoint save on clean shutdown
  const currentTimestamp = checkpointManager.getTimestamp();
  if (currentTimestamp) {
    await checkpointManager.saveCheckpoint(currentTimestamp);
  }

  prometheus.up.set(0); // Set poller as stopped
  logger.info("Polling loop has been gracefully stopped.");
}

async function fetchBatch(
  lastTimestamp: string | null,
  size: number
): Promise<InferenceLog[]> {
  logger.info(`Fetching batch from OpenSearch: size=${size}`);

  try {
    const query: any = {
      bool: {
        must_not: [{ exists: { field: "processed" } }],
      },
    };

    // Add timestamp range if we have a lastTimestamp
    if (lastTimestamp) {
      query.bool.must = [{ range: { "@timestamp": { gt: lastTimestamp } } }];
    }

    const response = await client.search({
      index: config.opensearch.index,
      body: {
        query,
        size,
        sort: [{ "@timestamp": "asc" }],
      },
    });

    const hits = response.body.hits.hits;
    logger.info(`Fetched ${hits.length} unprocessed records from OpenSearch`);

    return hits.map((hit: any) => hit._source as InferenceLog);
  } catch (error: any) {
    logger.error(`Error fetching batch from OpenSearch: ${error.message}`);
    throw error;
  }
}

async function markAsProcessed(logIds: string[]): Promise<void> {
  if (logIds.length === 0) return;

  try {
    const operations = logIds.flatMap((id) => [
      { update: { _index: config.opensearch.index, _id: id } },
      { doc: { processed: true, processedAt: new Date().toISOString() } },
    ]);

    await client.bulk({ body: operations });
    logger.info(`Marked ${logIds.length} records as processed`);
  } catch (error: any) {
    logger.error(`Error marking records as processed: ${error.message}`);
    throw error;
  }
}

async function callContractBatch(
  wallets: string[],
  logIds: string[]
): Promise<void> {
  logger.info(`Calling contract function with ${wallets.length} record(s)...`);

  try {
    const txHash = await writeContract(walletClient, {
      chain,
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "submitBatchInferenceLogs",
      args: [config.blockchain.appId, wallets, logIds],
    });
    logger.info(`Contract transaction submitted: ${txHash}`);

    const receipt = await waitForTransactionReceipt(walletClient, {
      hash: txHash,
    });
    logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
  } catch (error: any) {
    logger.error(`Error calling contract function: ${error.message}`);
    throw error; // Propagate error to allow proper retry handling
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries === 0) {
      logger.error("Max retries reached. Giving up.");
      throw error;
    }
    logger.warn(`Retrying in ${delay}ms... (${retries} retries left)`);
    await sleep(delay);
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
