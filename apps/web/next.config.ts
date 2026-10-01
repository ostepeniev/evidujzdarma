import path from "node:path";
import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), usb=(self), bluetooth=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // monorepo: trasování od kořene, aby standalone build obsahoval workspace balíčky
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
  transpilePackages: ["@ez/cz", "@ez/db", "@ez/fiscal-core"],
  serverExternalPackages: ["postgres", "node-forge", "nodemailer"],
  async rewrites() {
    // IndexNow: ověřovací soubor /{klíč}.txt
    return [{ source: "/:key([a-zA-Z0-9-]{8,128}).txt", destination: "/api/indexnow/key/:key" }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
