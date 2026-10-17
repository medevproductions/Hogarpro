import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()"
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.supabase.co https://script.google.com https://script.googleusercontent.com",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.firebaseio.com https://*.googleapis.com https://*.supabase.co https://script.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://*.supabase.co wss://*.supabase.co https://script.google.com https://script.googleusercontent.com https://hogarpro-xrhd.vercel.app http://localhost:3000",
      "frame-src 'self' https://script.google.com https://script.googleusercontent.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  eslint: {
    // Ignorar verificaciones de eslint durante el build de Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Asegurar que warnings de TS no detengan el build en Vercel
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
