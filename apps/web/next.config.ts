import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Request bodies pass through the /api rewrite; the default 10 MB would cut
    // document uploads. Just above the API's 25 MB limit, so a larger file still
    // reaches the API oversized and gets its 413 answer.
    proxyClientMaxBodySize: "26mb",
  },
  // The browser talks only to this origin; /api is proxied to the API, so the
  // httpOnly session cookie is first-party and CORS is not needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
