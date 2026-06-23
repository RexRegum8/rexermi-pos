import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['rexermi.uk'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'ih1.redbubble.net' },
      { protocol: 'https', hostname: '**' },
    ],
    unoptimized: false,
  },
  // Allow larger bodies for file uploads (receipts & product images) + transmigration zip
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  // Don't bundle these native/CJS modules — load from node_modules at runtime
  serverExternalPackages: ['better-sqlite3', 'xlsx'],
};

export default nextConfig;
