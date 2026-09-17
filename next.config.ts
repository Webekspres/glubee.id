import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/reports": ["./assets/fonts/*.ttf"],
    "/terms": ["./docs/legal/**/*.MD"],
    "/privacy": ["./docs/legal/**/*.MD"],
  },
};

export default nextConfig;
