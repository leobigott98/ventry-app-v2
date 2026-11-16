import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import type { Viewport } from "next";

import "@/app/globals.css";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { cn } from "@/lib/utils";

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans.woff2",
  variable: "--font-sans",
  weight: "200 800",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Ventry",
  icons: { icon: "/pwa/icon-192.png", apple: "/pwa/apple-touch-icon.png" },
  description: "Plataforma moderna de control de acceso para residencias con porteria.",
};

export const viewport: Viewport = {
  width: "device-width",
  themeColor: "#142f9d",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground",
          jakarta.variable,
          jetbrainsMono.variable,
        )}
      >
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
