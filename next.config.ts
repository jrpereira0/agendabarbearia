import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotos de celular passam facil de 1 MB (limite padrao)
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
