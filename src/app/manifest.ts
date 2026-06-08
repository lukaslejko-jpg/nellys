import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nellys",
    short_name: "Nellys",
    description: "Puzzle Solver for Pyraminx.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2b6fe8",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
