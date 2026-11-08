import type { MetadataRoute } from "next";

/**
 * Manifesto PWA: permite "Adicionar à tela inicial" no celular e abrir o sistema em tela cheia.
 * Servido em /manifest.webmanifest (liberado no matcher do proxy, sem exigir login).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PLASCOTEL",
    short_name: "PLASCOTEL",
    description: "Gestão comercial, clientes, vendas e cobranças — PLASCOTEL",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#171717",
    background_color: "#171717",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
