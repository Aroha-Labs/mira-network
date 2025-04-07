import { Client } from "@opensearch-project/opensearch";
import logger from "./logger";

// Constants for checkpoint storage
const CHECKPOINT_INDEX = "inference_bridge_checkpoints";
const CHECKPOINT_ID = "latest_timestamp";

/**
 * Checkpoint manager for tracking the last processed timestamp using OpenSearch
 */
export class CheckpointManager {
  private lastTimestamp: string | null = null;
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Ensure checkpoint index exists
   */
  private async ensureIndexExists(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: CHECKPOINT_INDEX,
      });

      if (!indexExists.body) {
        await this.client.indices.create({
          index: CHECKPOINT_INDEX,
          body: {
            mappings: {
              properties: {
                timestamp: { type: "date" },
                updated_at: { type: "date" },
              },
            },
          },
        });
        logger.info(`Created checkpoint index: ${CHECKPOINT_INDEX}`);
      }
    } catch (error) {
      logger.warn(`Error checking/creating checkpoint index: ${error}`);
      // Continue even if index creation fails, we'll handle errors during read/write
    }
  }

  /**
   * Load the last timestamp from OpenSearch
   */
  async loadCheckpoint(): Promise<string | null> {
    try {
      await this.ensureIndexExists();

      try {
        const response = await this.client.get({
          index: CHECKPOINT_INDEX,
          id: CHECKPOINT_ID,
        });

        if (response.body && response.body._source) {
          this.lastTimestamp = response.body._source.timestamp;
          logger.info(`Loaded checkpoint timestamp: ${this.lastTimestamp}`);
          return this.lastTimestamp;
        }
      } catch (err: any) {
        // If document doesn't exist, OpenSearch returns a 404 error
        // We'll handle this case by returning null
        if (err.statusCode === 404) {
          logger.info("No existing checkpoint found, starting from beginning");
          return null;
        }
        // Rethrow other errors
        throw err;
      }

      logger.info("No timestamp found in checkpoint document");
      return null;
    } catch (error) {
      logger.error(`Failed to load checkpoint: ${error}`);
      return null;
    }
  }

  /**
   * Save the last timestamp to OpenSearch
   */
  async saveCheckpoint(timestamp: string): Promise<void> {
    try {
      if (timestamp !== this.lastTimestamp) {
        await this.ensureIndexExists();

        // First update our in-memory timestamp to avoid duplicate processing
        // even if the OpenSearch write takes time
        this.lastTimestamp = timestamp;

        await this.client.index({
          index: CHECKPOINT_INDEX,
          id: CHECKPOINT_ID,
          body: {
            timestamp: timestamp,
            updated_at: new Date().toISOString(),
          },
          refresh: true, // Force refresh to make the update visible immediately
        });

        logger.debug(`Saved checkpoint timestamp: ${timestamp}`);
      }
    } catch (error) {
      logger.error(`Failed to save checkpoint: ${error}`);
    }
  }

  /**
   * Get the current checkpoint timestamp
   */
  getTimestamp(): string | null {
    return this.lastTimestamp;
  }
}
