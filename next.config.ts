import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bill images can be a few MB; raise the server action / body limit a little.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  // Only our own site (the /demo phone frame) may embed the app, so another
  // page can't frame the Approve button and trick a click.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
