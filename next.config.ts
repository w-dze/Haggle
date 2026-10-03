import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bill images can be a few MB; raise the server action / body limit a little.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
