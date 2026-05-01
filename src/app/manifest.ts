import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BnaaSaaS",
    short_name: "BnaaSaaS",
    description:
      "Suivi chantier, documents et finance pour projets genie civil en usage terrain et bureau.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#111111",
    lang: "fr",
    icons: [
      {
        src: "/pwa-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
