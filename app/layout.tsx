import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HogarPro - Plataforma de Streaming y Gestión",
  description: "Plataforma empresarial de administración y venta de cuentas de streaming con sincronización de códigos en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" style={{ backgroundColor: "#0B0E14", colorScheme: "dark" }}>
      <head>
        <meta name="theme-color" content="#0B0E14" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body 
        className="bg-[#0B0E14] text-slate-100 min-h-screen antialiased selection:bg-rose-600/30 selection:text-rose-200"
        style={{ backgroundColor: "#0B0E14", color: "#F8FAFC" }}
      >
        {children}
      </body>
    </html>
  );
}
