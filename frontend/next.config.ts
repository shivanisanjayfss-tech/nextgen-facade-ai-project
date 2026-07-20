import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCT_IMAGE_REMOTE_HOSTS } from "./lib/product-image-url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appDir, "..");

const nextConfig: NextConfig = {
  // Workspace packages (unpdf, @google/genai, …) are hoisted to the monorepo root.
  // Next.js 16 requires outputFileTracingRoot === turbopack.root when both are set.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  images: {
    remotePatterns: PRODUCT_IMAGE_REMOTE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/**",
    })),
  },
  serverExternalPackages: ["@google/genai", "unpdf"],
  experimental: {
    // Stale Turbopack FS cache after Import History HMR caused
    // "Failed to load chunk" for /next/static/chunks/* — keep disabled.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
