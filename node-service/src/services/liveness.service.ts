import axios from "axios";
import { FastifyBaseLogger } from "fastify";
import { Env } from "../config";
import { getLocalIp } from "../utils/network";

export class LivenessService {
  private interval?: NodeJS.Timeout;
  private machineIp: string;
  private routerUrl: string;

  constructor(private logger: FastifyBaseLogger) {
    this.machineIp = Env.MACHINE_IP || getLocalIp(logger);
    this.routerUrl = process.env.ROUTER_BASE_URL || "";
  }

  async start(): Promise<void> {
    // Validate requirements
    if (!this.routerUrl) {
      this.logger.error("ROUTER_BASE_URL is not set");
      throw new Error("Router base URL is required");
    }

    if (!Env.MACHINE_API_TOKEN) {
      this.logger.error("MACHINE_API_TOKEN is not set");
      throw new Error("Machine API token is required");
    }

    this.logger.info(`Starting liveness service for machine: ${this.machineIp}`);
    this.logger.info(`Machine name: ${Env.MACHINE_NAME || "Not set"}`);

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
            Authorization: `Bearer ${Env.MACHINE_API_TOKEN}`,
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