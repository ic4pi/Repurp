import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
} satisfies NextConfig & { agentRules?: boolean };

export default nextConfig;
