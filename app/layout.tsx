import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamHub Pro - Gestión & Venta de Cuentas de Streaming",
  description: "Plataforma automatizada para venta y administración de cuentas de streaming en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#141414] text-white min-h-screen antialiased selection:bg-[#E50914] selection:text-white">
        {children}
      </body>
    </html>
  );
}
