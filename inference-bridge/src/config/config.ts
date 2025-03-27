import { Chain } from "viem";
import logger from "../logger";

// Environment variables with defaults
const {
  OPENSEARCH_ENDPOINT,
  OPENSEARCH_USERNAME,
  OPENSEARCH_PASSWORD,
  OPENSEARCH_INDEX = "your-index",
  BATCH_SIZE = "100",
  POLL_INTERVAL_MS = "60000",
  RPC_URL_HTTP = "https://rpc-test0-two-zepe2m25hg.t.conduit.xyz",
  RPC_URL_WS = "wss://rpc-test0-two-zepe2m25hg.t.conduit.xyz",
  SIGNER_PRIVATE_KEY,
  APP_ID = "Klok",
} = process.env;

// Config validation
const requiredEnvVars = [
  "OPENSEARCH_ENDPOINT",
  "OPENSEARCH_USERNAME",
  "OPENSEARCH_PASSWORD",
  "SIGNER_PRIVATE_KEY",
];

// Validate all required environment variables
export function validateConfig() {
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  logger.info("Configuration validated successfully");
}

// Convert string values to appropriate types
export const config = {
  opensearch: {
    endpoint: OPENSEARCH_ENDPOINT!,
    username: OPENSEARCH_USERNAME!,
    password: OPENSEARCH_PASSWORD!,
    index: OPENSEARCH_INDEX,
    maxRetries: 3,
    requestTimeout: 30000,
    // Maximum number of processed IDs to keep in memory to handle indexing latency
    maxProcessedIdsCache: 10000,
  },
  polling: {
    batchSize: parseInt(BATCH_SIZE, 10),
    intervalMs: parseInt(POLL_INTERVAL_MS, 10),
  },
  blockchain: {
    appId: APP_ID,
    signerPrivateKey: SIGNER_PRIVATE_KEY!,
    rpcUrlHttp: RPC_URL_HTTP,
    rpcUrlWs: RPC_URL_WS,
  },
  circuitBreaker: {
    threshold: 5,
    timeout: 30000, // 30 seconds
  },
};

// Chain configuration for viem
export const chain: Chain = {
  id: 48499,
  name: "voyager",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.blockchain.rpcUrlHttp],
      webSocket: [config.blockchain.rpcUrlWs],
    },
  },
};
