import type { NextConfig } from "next";
import path from "path";

// Security headers applied to every response. CSP is intentionally omitted
// here: a strict policy risks breaking thirdweb wallet connections / RPC calls
// and is better introduced in Report-Only mode first (see public/.well-known).
// X-XSS-Protection is set to "0" per current OWASP guidance — the legacy
// auditor-era "1; mode=block" can itself introduce bugs in old browsers.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-XSS-Protection", value: "0" },
];


const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Headless checks and phone previews open the dev server as 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  // Parent folders (e.g. C:\Users\ADMIN\package-lock.json) confuse Turbopack's
  // workspace-root detection and break resolving deps like thirdweb/react.
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
