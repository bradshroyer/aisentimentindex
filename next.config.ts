import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Public read-only API: open to any origin. Also set in the handlers
        // (lib/api.ts); repeated here so cached/ISR responses carry it too.
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Permanent redirect from the old labs subdomain to the canonical domain
      {
        source: "/:path*",
        has: [{ type: "host", value: "labs.bradshroyer.com" }],
        destination: "https://sentimentindex.ai/:path*",
        permanent: true,
      },
      // Collapse www onto the apex
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sentimentindex.ai" }],
        destination: "https://sentimentindex.ai/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
