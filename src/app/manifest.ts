import type { MetadataRoute } from "next";

// Ikon dari mascot-head (docs/design/ASSET_PROMPTS.md, M3) di atas navy brand.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glubee",
    short_name: "Glubee",
    description: "Pencatatan dan pemantauan gula darah.",
    lang: "id",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#002A45",
    theme_color: "#011B2F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
