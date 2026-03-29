import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Manrope } from "next/font/google";

import "@/app/globals.css";

import { cn } from "@/lib/utils";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Ventry",
  description: "Plataforma moderna de control de acceso para residencias con porteria.",
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
          "min-h-screen font-sans text-foreground",
          manrope.variable,
          plexMono.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
