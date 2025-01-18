import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  /* TODO: remove this once we have a proper image CDN */
  images: { unoptimized: true },
  productionBrowserSourceMaps: true,
};

export default nextConfig;
