import * as os from "os";

/**
 * Get local IP address of the machine
 */
export function getLocalIp(logger: import('fastify').FastifyBaseLogger): string {
  try {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip over non-IPv4 and internal (loopback) addresses
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  } catch (error) {
    const err = error as Error;
    logger.info(`Error getting local IP: ${err.message}`);
    return "127.0.0.1";
  }
}
