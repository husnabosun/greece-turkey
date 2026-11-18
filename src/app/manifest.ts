import type { MetadataRoute } from "next";
import { APP_NAME } from "@/core/config/constants";

/** PWA web app manifest — service worker wiring follows in a later polish pass. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "AgroPulse",
    description: "Olive quality, risk intelligence, and B2B marketplace for Greece & Turkey.",
    start_url: "/el",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#FAFAF8",
    lang: "el",
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
