#!/usr/bin/env node
// Utilitário de banco via Supabase Management API (não requer senha do banco).
// Uso:
//   node scripts/db.mjs migrate          -> aplica migrações pendentes de supabase/migrations
//   node scripts/db.mjs sql "<sql>"      -> executa SQL (como postgres)
//   node scripts/db.mjs file <arquivo>   -> executa um arquivo SQL
// Requer SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF (lidos de .env.local).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
// DB_TARGET=prod usa PROD_SUPABASE_PROJECT_REF / PROD_SUPABASE_ACCESS_TOKEN (banco de produção).
const isProd = process.env.DB_TARGET === "prod";
const token = isProd ? process.env.PROD_SUPABASE_ACCESS_TOKEN : process.env.SUPABASE_ACCESS_TOKEN;
const ref = isProd ? process.env.PROD_SUPABASE_PROJECT_REF : process.env.SUPABASE_PROJECT_REF;
if (isProd) console.error(`[db] alvo: PRODUÇÃO (${ref})`);
if (!token || !ref) {
  console.error("Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF (ou PROD_* com DB_TARGET=prod) em .env.local");
  process.exitCode = 1;
}

export async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function migrate() {
  await query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const applied = new Set((await query("select version from supabase_migrations.schema_migrations")).map((r) => r.version));
  const dir = path.join(root, "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const name = rest.join("_").replace(/'/g, "''");
    process.stdout.write(`Aplicando ${f}... `);
    await query(`begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}');\ncommit;`);
    console.log("ok");
  }
  console.log("Migrações em dia.");
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === "migrate") await migrate();
  else if (cmd === "sql") console.log(JSON.stringify(await query(arg), null, 2));
  else if (cmd === "file") console.log(JSON.stringify(await query(fs.readFileSync(arg, "utf8")), null, 2));
  else console.log("Comandos: migrate | sql \"...\" | file <arquivo>");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
