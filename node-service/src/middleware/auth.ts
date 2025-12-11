import { FastifyRequest, FastifyReply } from "fastify";
import { EnvConfig } from "../config/env.types";

/**
 * Creates authentication middleware that checks for SERVICE_ACCESS_TOKEN
 * If no token is configured, auth is skipped (for local/trusted environments)
 */
export function createAuthMiddleware(config: EnvConfig) {
  // If no access token configured, skip auth
  if (!config.SERVICE_ACCESS_TOKEN) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // No auth required - pass through
      return;
    };
  }

  // Return auth middleware function that validates token
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    
    // Check for Authorization header
    if (!authHeader) {
      return reply.code(401).send({ 
        error: "Unauthorized",
        message: "Missing authorization header" 
      });
    }

    // Check for Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        error: "Unauthorized",
        message: "Invalid authorization format. Use: Bearer <token>" 
      });
    }
    
    const token = authHeader.substring(7);
    
    // Validate token
    if (token !== config.SERVICE_ACCESS_TOKEN) {
      return reply.code(401).send({ 
        error: "Unauthorized",
        message: "Invalid access token" 
      });
    }

    // Token is valid, continue to handler
  };
}