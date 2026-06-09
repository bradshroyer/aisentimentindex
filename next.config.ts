import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
