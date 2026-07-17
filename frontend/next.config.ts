import type { NextConfig } from "next";
import { PRODUCT_IMAGE_REMOTE_HOSTS } from "./lib/product-image-url";

const nextConfig: NextConfig = {
  // Turbopack root must be the Next.js app directory (frontend/), not the monorepo
  // parent. Pointing at ".." drops nested App Router pages such as /admin/import.
  turbopack: {
    root: __dirname,
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
