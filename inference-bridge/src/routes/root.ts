import { FastifyPluginAsync } from "fastify";
import {
  pollLoop,
  checkOpenSearchConnection,
  lastPollTimestamp,
  POLL_INTERVAL_MS_NUM,
} from "../poller";
import { prometheus } from "../metrics/prometheus";

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  const shutdownFlag = { shuttingDown: false };
  let pollerStatus = {
    running: false,
    startTime: null as Date | null,
  };

  // Enhanced health check endpoint that actually checks dependencies
  fastify.get("/health", async (request, reply) => {
    try {
      // Check OpenSearch connection
      const opensearchHealthy = await checkOpenSearchConnection();

      const health = {
        status: opensearchHealthy ? "ok" : "degraded",
        components: {
          poller: pollerStatus.running ? "up" : "down",
          opensearch: opensearchHealthy ? "up" : "down",
        },
      };

      if (!opensearchHealthy) {
        reply.code(503); // Service Unavailable if dependencies are down
      }

      return health;
    } catch (error) {
      reply.code(500);
      return { status: "error", error: (error as Error).message };
    }
  });

  // Prometheus metrics endpoint
  fastify.get("/metrics", async (request, reply) => {
    reply.header("Content-Type", prometheus.register.contentType);
    return prometheus.register.metrics();
  });

  // Handle graceful shutdown signals for the poller only
  // (fastify-cli handles the server shutdown automatically)
  const shutdownHandler = async () => {
    fastify.log.info("Shutdown signal received, stopping poller...");
    shutdownFlag.shuttingDown = true;
  };

  process.on("SIGTERM", shutdownHandler);
  process.on("SIGINT", shutdownHandler);

  // Start the polling loop with enhanced monitoring
  pollerStatus.running = true;
  pollerStatus.startTime = new Date();

  fastify.log.info("Starting poller...");
  pollLoop(shutdownFlag).catch((err) => {
    fastify.log.error("Poller error:", err);
    pollerStatus.running = false;
    prometheus.up.set(0); // Ensure metric is set to 0 on error
  });

  // Periodically update the poller status
  const statusInterval = setInterval(() => {
    // If we haven't polled in a long time (3x the interval), consider the poller down
    if (
      lastPollTimestamp &&
      Date.now() - lastPollTimestamp.getTime() > POLL_INTERVAL_MS_NUM * 3
    ) {
      pollerStatus.running = false;
      prometheus.up.set(0); // Update Prometheus metric
      fastify.log.warn("Poller appears to be stalled");
    }
  }, 30000);

  // Clean up interval on server close
  fastify.addHook("onClose", () => {
    clearInterval(statusInterval);
  });
};

export default root;
