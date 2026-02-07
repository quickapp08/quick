import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quick",
    short_name: "Quick",
    description: "Fast typing word game",
    start_url: "/",
    display: "standalone",
    background_color: "#020617", // slate-950
    theme_color: "#1e3a8a", // blue-ish (možeš promijenit)
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
