import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "App Citas - By KR System",
    short_name: "App Citas",
    description: "Agenda y reservas para negocios de servicios — App Citas",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6f4",
    theme_color: "#a8355a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
