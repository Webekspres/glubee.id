import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/reports": ["./assets/fonts/*.ttf"],
    "/terms": ["./docs/legal/**/*.MD"],
    "/privacy": ["./docs/legal/**/*.MD"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Halaman data kesehatan tidak boleh dibingkai situs lain (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
