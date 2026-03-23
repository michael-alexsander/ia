import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // PDF em base64 pode exceder o limite padrão de 1MB
    },
  },
};

export default nextConfig;
