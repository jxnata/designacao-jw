# Designações — Vida e Ministério

App desktop offline (Tauri v2 + React + SQLite) para montar a programação de
designações da reunião Vida e Ministério: você importa a apostila (mwb)
baixada direto do jw.org — em `.jwpub` (o mesmo arquivo do JW Library,
formato recomendado) ou em PDF —, o app lê a programação das semanas a partir
dela, distribui as partes entre a congregação respeitando os critérios
(anciãos/servos, homens, mulheres, batizados) e mantendo o número de
designações equilibrado entre as pessoas, mostra um preview editável antes de
gravar, e gera uma página imprimível no layout do modelo em PDF.

O app nunca acessa a internet para buscar conteúdo da reunião — toda a
importação acontece a partir do arquivo que você baixa manualmente, em
conformidade com os termos de uso do jw.org.

## Rodando em desenvolvimento

Pré-requisitos: [Node 18+](https://nodejs.org), [Rust](https://rustup.rs) e os
[pré-requisitos do Tauri](https://tauri.app/start/prerequisites/) para o seu
sistema operacional.

```bash
npm install
npm run tauri dev
```

O `postinstall` do `npm install` copia o binário WASM do `sql.js` (usado
para ler o `.jwpub`) para `public/sql-wasm.wasm` — se ele faltar (ex.: um
`npm ci --ignore-scripts`), rode `node scripts/copiar-wasm.mjs` manualmente
ou `npm run build`, que também o garante via `prebuild`.

## Testes

```bash
cd src-tauri
cargo test      # balanceador de designações
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

```bash
npm run build    # tsc + build do frontend
npm run test     # parsers da apostila (.jwpub e PDF) e demais testes do frontend
```

## Build / releases

Builds para macOS, Linux e Windows são gerados automaticamente pelo GitHub
Actions (`.github/workflows/release.yml`) sempre que uma tag `v*` é
publicada:

```bash
git tag v0.1.0
git push --tags
```

O workflow cria um *release draft* no GitHub com os instaladores dos três
sistemas. Como o app não é assinado digitalmente:

- **macOS**: na primeira abertura, clique com o botão direito no app →
  "Abrir" (o Gatekeeper bloqueia apps não notarizados na abertura normal).
- **Windows**: o SmartScreen pode avisar que o app não é reconhecido — clique
  em "Mais informações" → "Executar assim mesmo".

## Estrutura

- `src/lib/mwb/` — lê a apostila (mwb) importada pelo usuário e monta a
  estrutura de partes da semana, em dois formatos: `.jwpub`
  (`jwpub.ts`/`jwpub-mapear.ts`, via
  [`meeting-schedules-parser`](https://github.com/sws2apps/meeting-schedules-parser))
  e PDF (`extrair.ts`/`parse.ts`, texto → recomposição de colunas e acentos
  → partes). `index.ts` decide o parser pela extensão do arquivo.
- `src-tauri/src/assign/` — regras de elegibilidade por tipo de parte e o
  algoritmo de designação balanceada.
- `src-tauri/src/db.rs` — schema/migrations do SQLite.
- `src/pages/` — Pessoas, Designação (importação, preview + confirmação),
  Histórico, Backup, Configurações e a página de impressão.
