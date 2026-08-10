import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent folders (e.g. C:\Users\ADMIN\package-lock.json) confuse Turbopack's
  // workspace-root detection and break resolving deps like thirdweb/react.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
