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

// Report-Only CSP: the browser enforces NOTHING — it only logs violations to
// the console. Shipped this way so wallet login, RPC and embeds can't break.
// Watch the console across a real wallet connect + checkout flow, add any
// origins that get reported, then switch the key to "Content-Security-Policy"
// to enforce. Drafted from the external origins the client currently uses.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://*.thirdweb.com https://platform.twitter.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://res.cloudinary.com https://api.qrserver.com https://*.thirdweb.com https://pbs.twimg.com",
  "connect-src 'self' https://*.thirdweb.com wss://*.thirdweb.com https://api.avax.network https://api.avax-test.network https://glacier-api.avax.network https://*.walletconnect.com wss://*.walletconnect.com",
  "frame-src 'self' https://*.thirdweb.com https://embedded-wallet.thirdweb.com https://platform.twitter.com https://syndication.twitter.com",
  "worker-src 'self' blob:",
].join("; ");

securityHeaders.push({
  key: "Content-Security-Policy-Report-Only",
  value: cspReportOnly,
});

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
