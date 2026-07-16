import path from "node:path";
import type { NextConfig } from "next";
import { PRODUCT_IMAGE_REMOTE_HOSTS } from "./lib/product-image-url";

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack does not rescan the monorepo on every request.
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  images: {
    remotePatterns: PRODUCT_IMAGE_REMOTE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
      pathname: "/**",
    })),
  },
  serverExternalPackages: ["@google/genai"],
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
