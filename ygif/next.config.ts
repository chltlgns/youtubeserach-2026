import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Exclude browser automation packages from serverless bundling
  serverExternalPackages: ['puppeteer', 'puppeteer-extra', 'puppeteer-extra-plugin-stealth', 'playwright', 'playwright-extra'],
  // Headers for SharedArrayBuffer support (required for FFmpeg WASM)
  async headers() {
    return [
      {
        source: "/edit/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

