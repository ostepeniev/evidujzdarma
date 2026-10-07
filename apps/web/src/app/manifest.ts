import type { MetadataRoute } from "next";
import { isClosed } from "@/lib/launch";

export default function manifest(): MetadataRoute.Manifest {
  // „Nainstalovat aplikaci“ z veřejné stránky nesmí vést na zavřenou pokladnu (401) – R7.6
  const start = isClosed("/pokladna") ? "/" : "/pokladna";
  return {
    name: "EvidujZdarma – pokladna pro EET 2.0",
    short_name: "Pokladna",
    description: "Bezplatná pokladna pro evidenci tržeb EET 2.0 – i bez signálu.",
    id: start,
    start_url: start,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f7f4",
    theme_color: "#0b7a57",
    lang: "cs",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
