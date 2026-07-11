import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack does not rescan the monorepo on every request.
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  serverExternalPackages: ["@google/genai"],
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
