import axios, { AxiosInstance, AxiosResponse } from "axios";
import * as os from "os";
import { Env } from "../config";

import pino from "pino";
const logger = pino();

/**
 * Generate a tiny UUID-like alphanumeric string for machine identification
 *
 * @param length Length of the string to generate (default: 8)
 * @returns A random alphanumeric string
 */
function generateMachineId(length: number = 8): string {
  // Use only lowercase letters and numbers for better readability
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mira-";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Get local IP address of the machine
 */
export function getLocalIp(): string {
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

/**
 * Helper function to perform HTTP requests with retry logic
 */
async function performRegistrationRequest(
  client: AxiosInstance,
  url: string,
  headers: Record<string, string>,
  jsonData?: Record<string, any>
): Promise<AxiosResponse> {
  const maxRetries = 5;
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < maxRetries) {
    try {
      if (jsonData) {
        return await client.post(url, jsonData, { headers });
      } else {
        return await client.get(url, { headers });
      }
    } catch (error) {
      const err = error as Error;
      lastError = err;
      retryCount++;

      // Calculate exponential backoff time
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 30000);
      logger.info(
        `Request failed, retrying in ${waitTime}ms (attempt ${retryCount}/${maxRetries})`
      );

      // Wait for the backoff period
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw lastError || new Error("Max retries reached with no specific error");
}

/**
 * Register the machine with the router and obtain or create a machine API token
 * Uses retry logic to handle transient network issues
 *
 * @param routerBaseUrl Base URL of the router service
 * @returns The machine API token if successful, null otherwise
 */
export async function registerMachine(routerBaseUrl: string) {
  const machineIp = Env.MACHINE_IP || getLocalIp();
  // Use provided machine name or generate a tiny UUID-like name
  const machineName = Env.MACHINE_NAME || generateMachineId();
  const adminToken = Env.ADMIN_API_TOKEN;

  if (!adminToken) {
    logger.error("ADMIN_API_TOKEN is not set");
    return null;
  }

  if (!routerBaseUrl) {
    logger.error("ROUTER_BASE_URL is not set");
    return null;
  }

  const headers = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  try {
    const client = axios.create({ timeout: 30000 });

    // Step 1: Check if machine with this IP is already registered
    const checkMachineUrl = `${routerBaseUrl}/admin/machines/${machineIp}`;
    let existingMachine = null;

    try {
      const checkResponse = await client.get(checkMachineUrl, { headers });
      if (checkResponse.status === 200) {
        // Machine exists, get its name for token description
        existingMachine = checkResponse.data;
        const existingName = existingMachine?.name || machineName;
        logger.info(`Found existing machine: ${existingName} at ${machineIp}`);
      }
    } catch (error) {
      // Machine not found, will register a new one
      logger.info(
        `No existing machine found at ${machineIp}, will register new`
      );
    }

    // Step 2: Registration with retry
    const registerUrl = `${routerBaseUrl}/admin/machines/register`;
    const registerData = {
      network_ip: machineIp,
      name: machineName,
      description: `Auto-registered machine: ${machineName}`,
      disabled: false,
    };

    logger.info(`Registering machine '${machineName}' at ${machineIp}`);
    try {
      const response = await performRegistrationRequest(
        client,
        registerUrl,
        headers,
        registerData
      );
      logger.info(`Machine registration status: ${response.status}`);
    } catch (error) {
      logger.error("Failed to register machine after multiple attempts");
      return null;
    }

    // Step 3: List existing tokens with retry
    const tokensUrl = `${routerBaseUrl}/admin/machines/${machineIp}/auth-tokens`;
    let tokens;

    try {
      const tokensResponse = await performRegistrationRequest(
        client,
        tokensUrl,
        headers
      );
      tokens = tokensResponse.data;
    } catch (error) {
      logger.error("Failed to list tokens after multiple attempts");
      return null;
    }

    // If tokens exist, use the first one
    if (tokens && tokens.length > 0) {
      logger.info("Found existing machine token");
      return tokens[0].api_token;
    }

    // Step 4: Create token if none exists (with retry)
    const createTokenUrl = `${routerBaseUrl}/admin/machines/${machineIp}/auth-tokens`;
    const tokenData = {
      description: `Auto-generated token for ${machineName}`,
    };

    logger.info("Creating new machine token");
    try {
      const tokenResponse = await performRegistrationRequest(
        client,
        createTokenUrl,
        headers,
        tokenData
      );
      const newToken = tokenResponse.data;
      logger.info("New machine token created successfully");

      // Set the environment variable and update Env class
      process.env.MACHINE_API_TOKEN = newToken.api_token;

      // Also save the generated machine name
      if (!Env.MACHINE_NAME) {
        process.env.MACHINE_NAME = machineName;
        Env.MACHINE_NAME = machineName;
      }

      return newToken.api_token;
    } catch (error) {
      logger.error("Failed to create token after multiple attempts");
      return null;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(
      `Unexpected error during machine registration: ${err.message}`
    );
    return null;
  }
}
