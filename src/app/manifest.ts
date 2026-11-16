import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Schemata: learn databases",
    short_name: "Schemata",
    description: "Learn databases: a real Postgres SQL editor, ER diagrams, design problems, interview questions and a roadmap. Works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f5ef",
    theme_color: "#f7f5ef",
    categories: ["education", "developer"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "SQL editor", url: "/playground", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Practice", url: "/questions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Schema diagrams", url: "/erd", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
