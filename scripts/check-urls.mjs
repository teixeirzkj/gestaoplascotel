#!/usr/bin/env node
// Guarda de integridade: falha o build se o código contiver URLs absolutas para domínios não aprovados.
// Motivo: links internos chegaram a ser gravados apontando para um domínio externo desconhecido.
// Rotas internas devem ser caminhos relativos ("/clientes"), nunca URLs absolutas.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src", "supabase", "public"];
const SCAN_FILES = ["next.config.ts", "vercel.json"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".sql", ".json", ".css", ".webmanifest", ".svg"]);

// Domínios aprovados (o próprio Supabase do projeto entra via variável de ambiente, não no código).
const ALLOWED_HOSTS = [
  /^localhost$/,
  /^local\.invalid$/, // origem sonda usada em safe-redirect
  /^www\.w3\.org$/, // namespaces SVG
  /^wa\.me$/, // abrir conversa no WhatsApp (sem disparo automático)
  /^(www\.)?google\.com$/, // links do Google Maps na agenda
  /^openapi\.vercel\.sh$/, // $schema do vercel.json
];

const URL_RE = /\bhttps?:\/\/([a-zA-Z0-9.-]+)/g;
const problems = [];

function scanFile(file) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(URL_RE)) {
      const host = m[1].toLowerCase();
      if (!ALLOWED_HOSTS.some((re) => re.test(host))) problems.push(`${rel}:${i + 1}  domínio não aprovado: ${host}`);
    }
    // Atributos href/src absolutos em JSX devem ser só os aprovados acima; caminhos internos começam com "/"
  });
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) scanFile(full);
  }
}

SCAN_DIRS.forEach((d) => walk(path.join(root, d)));
SCAN_FILES.forEach((f) => fs.existsSync(path.join(root, f)) && scanFile(path.join(root, f)));

if (problems.length) {
  console.error("\n✖ URLs para domínios não aprovados encontradas no código:\n");
  problems.forEach((p) => console.error("  " + p));
  console.error("\nUse caminhos relativos para rotas internas. Se o domínio for legítimo, adicione-o em scripts/check-urls.mjs.\n");
  process.exit(1);
}
console.log("✓ check-urls: nenhuma URL para domínio não aprovado.");
