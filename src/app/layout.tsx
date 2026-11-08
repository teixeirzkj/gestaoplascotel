import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PLASCOTEL", template: "%s · PLASCOTEL" },
  description: "Gestão comercial, clientes, vendas e cobranças — PLASCOTEL",
  applicationName: "PLASCOTEL",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PLASCOTEL", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Toda página é renderizada por requisição: necessário para o nonce da CSP (gerado em src/proxy.ts)
  // ser aplicado aos scripts do Next. Sem isso, páginas estáticas (ex.: 404) teriam scripts bloqueados.
  await connection();
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
