import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: ["192.168.1.34:3000", "localhost:3000"],
    },
  },
  allowedDevOrigins: ["192.168.1.34"],
};

export default nextConfig;
