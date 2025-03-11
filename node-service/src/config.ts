/**
 * Environment configuration class for the application.
 */
export class Env {
  /**
   * IP address of the current machine in the network.
   * If not provided, will be automatically detected.
   */
  static MACHINE_IP: string = process.env.MACHINE_IP || "";

  /**
   * Human-readable name for this machine instance.
   * If not provided, will be automatically generated as a unique ID (e.g. mira-a7b3c9d2).
   */
  static MACHINE_NAME: string = process.env.MACHINE_NAME || "";

  /**
   * Admin API token used for machine registration and token management.
   * Required for the service to register itself with the router.
   */
  static ADMIN_API_TOKEN: string = process.env.ADMIN_API_TOKEN || "";

  /**
   * Machine-specific API token used for regular operations like liveness checks.
   * If not provided at startup, will be obtained during registration.
   */
  static MACHINE_API_TOKEN: string = process.env.MACHINE_API_TOKEN || "";
}
