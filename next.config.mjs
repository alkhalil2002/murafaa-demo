/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits .next/standalone with a minimal server + only the traced deps, so the
  // Cloud Run image does not ship the full node_modules tree.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint is run explicitly via `npm run lint`; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
  // Heavy node-only deps used solely in server code — keep them out of the
  // bundle so Next doesn't try to trace/bundle Chromium etc.
  serverExternalPackages: ["puppeteer", "@google-cloud/storage"],
  webpack: (config) => {
    // The GCS driver loads its OPTIONAL SDK via a non-literal dynamic import
    // (present only in prod images); silence the expected expression warning.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
};

export default nextConfig;
