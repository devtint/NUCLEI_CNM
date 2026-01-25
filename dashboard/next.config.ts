import type { NextConfig } from "next";

// Parse allowed origins from environment or use defaults
const defaultOrigins = ["localhost:3000"];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : defaultOrigins;

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((o) => o.trim())
  : [];

const nextConfig: NextConfig = {
  output: "standalone", // Optimized for Docker deployment
  experimental: {
    serverActions: {
      allowedOrigins: allowedOrigins,
    },
  },
  ...(allowedDevOrigins.length > 0 && { allowedDevOrigins }),
};

export default nextConfig;
