import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fly Code Auditor",
  description: "Asistente tecnico interno bilingue de Fly Electric Solutions LLC"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0a0a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-fly-black text-fly-white min-h-screen font-sans">{children}</body>
    </html>
  );
}
