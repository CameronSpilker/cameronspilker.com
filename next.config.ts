import type { NextConfig } from "next";

/**
 * The character stage runs model-written code (in a worker it starts), so its
 * document gets a policy that refuses every network connection. It is also
 * framed with `sandbox="allow-scripts"` and no `allow-same-origin`, which gives
 * it an opaque origin: no cookies, no storage, no reach into the page.
 *
 * `'unsafe-eval'` is there because running the builder is, unavoidably, an
 * eval. It is confined to this sandboxed document and its worker.
 */
const STAGE_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-eval' blob:",
  "worker-src blob:",
  "img-src blob: data:",
  "style-src 'unsafe-inline'",
  "connect-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/character-stage/:path*",
        headers: [
          { key: "Content-Security-Policy", value: STAGE_CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
