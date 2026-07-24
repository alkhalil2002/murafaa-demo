/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint is run explicitly via `npm run lint`; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
