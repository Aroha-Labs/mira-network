import { Client } from "@opensearch-project/opensearch";
import logger from "../logger";

// Constants for configuration storage
const CONFIG_INDEX = "inference_bridge_config";

// Base configuration manager for working with OpenSearch-based configuration
export class OpenSearchConfigManager {
  protected client: Client;
  private indexInitialized = false;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Ensure configuration index exists
   */
  protected async ensureIndexExists(): Promise<void> {
    if (this.indexInitialized) return;

    try {
      const indexExists = await this.client.indices.exists({
        index: CONFIG_INDEX,
      });

      if (!indexExists.body) {
        await this.client.indices.create({
          index: CONFIG_INDEX,
          body: {
            mappings: {
              properties: {
                type: { type: "keyword" },
                key: { type: "keyword" },
                value: { type: "object", enabled: false },
                updated_at: { type: "date" },
              },
            },
          },
        });
        logger.info(`Created configuration index: ${CONFIG_INDEX}`);
      }

      this.indexInitialized = true;
    } catch (error) {
      logger.warn(`Error checking/creating configuration index: ${error}`);
      // Continue even if index creation fails, we'll handle errors during read/write
    }
  }

  /**
   * Get a configuration value
   */
  protected async getConfig<T>(type: string, key: string): Promise<T | null> {
    try {
      await this.ensureIndexExists();

      const docId = `${type}:${key}`;

      try {
        const response = await this.client.get({
          index: CONFIG_INDEX,
          id: docId,
        });

        if (
          response.body &&
          response.body._source &&
          response.body._source.value
        ) {
          logger.debug(`Retrieved config [${type}:${key}]`);
          return response.body._source.value as T;
        }
      } catch (err: any) {
        // If document doesn't exist, OpenSearch returns a 404 error
        if (err.statusCode === 404) {
          logger.info(`No config found for [${type}:${key}]`);
          return null;
        }
        throw err;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get config [${type}:${key}]: ${error}`);
      return null;
    }
  }

  /**
   * Save a configuration value
   */
  protected async saveConfig<T>(
    type: string,
    key: string,
    value: T
  ): Promise<void> {
    try {
      await this.ensureIndexExists();

      const docId = `${type}:${key}`;

      await this.client.index({
        index: CONFIG_INDEX,
        id: docId,
        body: {
          type,
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        refresh: true, // Force refresh to make the update visible immediately
      });

      logger.debug(`Saved config [${type}:${key}]`);
    } catch (error) {
      logger.error(`Failed to save config [${type}:${key}]: ${error}`);
    }
  }
}

/**
 * Checkpoint manager using the global configuration system
 */
export class CheckpointManager extends OpenSearchConfigManager {
  private static CONFIG_TYPE = "checkpoint";
  private static DEFAULT_KEY = "latest";
  private lastTimestamp: string | null = null;

  constructor(client: Client) {
    super(client);
  }

  /**
   * Load the last timestamp from OpenSearch
   */
  async loadCheckpoint(
    key = CheckpointManager.DEFAULT_KEY
  ): Promise<string | null> {
    const timestamp = await this.getConfig<string>(
      CheckpointManager.CONFIG_TYPE,
      key
    );
    this.lastTimestamp = timestamp;

    if (timestamp) {
      logger.info(`Loaded checkpoint timestamp [${key}]: ${timestamp}`);
    } else {
      logger.info(
        `No checkpoint found for key [${key}], starting from beginning`
      );
    }

    return timestamp;
  }

  /**
   * Save the last timestamp to OpenSearch
   */
  async saveCheckpoint(
    timestamp: string,
    key = CheckpointManager.DEFAULT_KEY
  ): Promise<void> {
    if (timestamp !== this.lastTimestamp) {
      // First update our in-memory timestamp to avoid duplicate processing
      this.lastTimestamp = timestamp;

      await this.saveConfig(CheckpointManager.CONFIG_TYPE, key, timestamp);
    }
  }

  /**
   * Get the current checkpoint timestamp
   */
  getTimestamp(): string | null {
    return this.lastTimestamp;
  }
}

/**
 * Future example: Feature flags manager using the same config system
 */
export class FeatureFlagManager extends OpenSearchConfigManager {
  private static CONFIG_TYPE = "feature-flag";
  private cache = new Map<string, boolean>();

  constructor(client: Client) {
    super(client);
  }

  async isFeatureEnabled(
    featureName: string,
    defaultValue = false
  ): Promise<boolean> {
    if (this.cache.has(featureName)) {
      return this.cache.get(featureName)!;
    }

    const enabled =
      (await this.getConfig<boolean>(
        FeatureFlagManager.CONFIG_TYPE,
        featureName
      )) ?? defaultValue;
    this.cache.set(featureName, enabled);
    return enabled;
  }

  async setFeature(featureName: string, enabled: boolean): Promise<void> {
    this.cache.set(featureName, enabled);
    await this.saveConfig(FeatureFlagManager.CONFIG_TYPE, featureName, enabled);
  }
}
