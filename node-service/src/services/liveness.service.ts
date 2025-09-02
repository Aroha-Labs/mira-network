import axios from "axios";
import { FastifyBaseLogger } from "fastify";
import { EnvConfig } from "../config";
import { getLocalIp } from "../utils/network";

export class LivenessService {
  private interval?: NodeJS.Timeout;
  private machineIp: string;
  private routerUrl: string;
  private machineApiToken: string;
  private machineName: string;

  constructor(private logger: FastifyBaseLogger, config: EnvConfig) {
    this.machineIp = config.MACHINE_IP || getLocalIp(logger);
    this.routerUrl = config.ROUTER_BASE_URL;
    this.machineApiToken = config.MACHINE_API_TOKEN;
    this.machineName = config.MACHINE_NAME || "Not set";
  }

  async start(): Promise<void> {
    this.logger.info(`Starting liveness service for machine: ${this.machineIp}`);
    this.logger.info(`Machine name: ${this.machineName}`);

    // Start periodic updates
    this.interval = setInterval(() => this.updateLiveness(), 3000);
    
    // Initial update
    await this.updateLiveness();
  }

  private async updateLiveness(): Promise<void> {
    const url = `${this.routerUrl}/liveness/${this.machineIp}`;

    try {
      await axios.post(
        url,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.machineApiToken}`,
          },
        }
      );
      this.logger.debug(`Liveness check successful for ${this.machineIp}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in liveness check: ${err.message}`);
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      this.logger.info("Liveness service stopped");
    }
  }
}