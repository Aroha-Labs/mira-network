import type { NextConfig } from "next";
const nrExternals = require("newrelic/load-externals");

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  /* TODO: remove this once we have a proper image CDN */
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ["newrelic"],
  },
  webpack: (config) => {
    nrExternals(config);
    return config;
  },
};

export default nextConfig;
