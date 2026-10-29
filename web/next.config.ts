import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Headless checks and phone previews open the dev server as 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  // Parent folders (e.g. C:\Users\ADMIN\package-lock.json) confuse Turbopack's
  // workspace-root detection and break resolving deps like thirdweb/react.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
