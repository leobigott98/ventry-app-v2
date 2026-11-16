import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ventry",
    short_name: "Ventry",
    description: "Control de acceso residencial",
    lang: "es",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f2f4f8",
    theme_color: "#142f9d",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
