#!/usr/bin/env node
//
// Copia o binário WASM do sql.js (usado pela lib `meeting-schedules-parser`
// para ler o SQLite dentro do .jwpub) para `public/`, de onde o Vite o
// serve na raiz do app — a lib faz `fetch('./sql-wasm.wasm')`, relativo à
// URL do documento.
//
// Rodado via `postinstall` (garante o arquivo logo após `npm install`) e
// `prebuild` (garante também em CI, mesmo com `--ignore-scripts`).

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "sql-wasm.wasm");

const candidatos = [
  join(raiz, "node_modules", "meeting-schedules-parser", "dist", "sql-wasm.wasm"),
  join(raiz, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
];

const origem = candidatos.find(existsSync);
if (!origem) {
  console.warn(
    "[copiar-wasm] Não encontrei sql-wasm.wasm em node_modules — a importação de arquivos .jwpub não vai " +
      "funcionar até rodar `npm install` de novo.",
  );
  process.exit(0);
}

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origem, destino);
console.log(`[copiar-wasm] ${origem} -> ${destino}`);
