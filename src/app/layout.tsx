import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, IBM_Plex_Mono, Syne } from "next/font/google";

import "@/app/globals.css";

import { cn } from "@/lib/utils";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
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
          "min-h-screen bg-background font-sans text-foreground",
          dmSans.variable,
          syne.variable,
          plexMono.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
