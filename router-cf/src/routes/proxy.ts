import { Hono } from "hono";
import type { AppContext } from "../env";
import { authMiddleware } from "../middleware/auth";

export const proxyRoutes = new Hono<AppContext>();

proxyRoutes.use("*", authMiddleware);

// GET /proxy-image - Proxy external images (for avatars, etc.)
proxyRoutes.get("/proxy-image", async (c) => {
  const url = c.req.query("url");

  if (!url) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  try {
    // Validate URL is from allowed domains
    const parsedUrl = new URL(url);
    const allowedDomains = [
      "lh3.googleusercontent.com", // Google avatars
      "avatars.githubusercontent.com", // GitHub avatars
      "cdn.discordapp.com", // Discord avatars
      "pbs.twimg.com", // Twitter avatars
    ];

    if (!allowedDomains.some((domain) => parsedUrl.hostname.endsWith(domain))) {
      return c.json({ error: "Domain not allowed" }, 403);
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mira-Network-Proxy/1.0",
      },
    });

    if (!response.ok) {
      return c.json({ error: "Failed to fetch image" }, response.status);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with proper headers
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });
  } catch (error) {
    console.error("[proxy] Error fetching image:", error);
    return c.json({ error: "Failed to proxy image" }, 500);
  }
});
