import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Ignorar verificaciones de eslint durante el build de Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Asegurar que warnings de TS no detengan el build en Vercel
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
