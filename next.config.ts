import type { NextConfig } from "next";

const isolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // credentialless is friendlier than require-corp for third-party assets
  // while still enabling crossOriginIsolated / SharedArrayBuffer where needed.
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
];

const nextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isolationHeaders,
      },
      {
        source: "/_next/static/chunks/:path*",
        headers: isolationHeaders,
      },
    ];
  },
} satisfies NextConfig & { agentRules?: boolean };

export default nextConfig;
