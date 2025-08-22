/**
 * Environment configuration class for the application.
 */
export class Env {
  /**
   * IP address of the current machine in the network.
   * If not provided, will be automatically detected.
   * Used for liveness checks and machine identification.
   */
  static MACHINE_IP: string = process.env.MACHINE_IP || "";

  /**
   * Human-readable name for this machine instance.
   * Optional - used for logging and identification purposes.
   */
  static MACHINE_NAME: string = process.env.MACHINE_NAME || "";

  /**
   * Admin API token - NO LONGER USED.
   * Kept for backward compatibility but will be removed in future versions.
   * @deprecated Machine registration is now handled manually by administrators.
   */
  static ADMIN_API_TOKEN: string = process.env.ADMIN_API_TOKEN || "";

  /**
   * Machine-specific API token used for operations like liveness checks.
   * REQUIRED - Must be provided by administrator before starting the service.
   * To obtain a token:
   * 1. Admin creates machine entry in router database
   * 2. Admin generates machine token via admin API
   * 3. Token is provided via MACHINE_API_TOKEN environment variable
   */
  static MACHINE_API_TOKEN: string = process.env.MACHINE_API_TOKEN || "";
}
