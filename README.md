# Designações — Vida e Ministério

App desktop offline (Tauri v2 + React + SQLite) para montar a programação de
designações da reunião Vida e Ministério: busca a programação das próximas 8
semanas em wol.jw.org, distribui as partes entre a congregação respeitando os
critérios (anciãos/servos, homens, mulheres, batizados) e mantendo o número de
designações equilibrado entre as pessoas, mostra um preview editável antes de
gravar, e gera uma página imprimível no layout do modelo em PDF.

## Rodando em desenvolvimento

Pré-requisitos: [Node 18+](https://nodejs.org), [Rust](https://rustup.rs) e os
[pré-requisitos do Tauri](https://tauri.app/start/prerequisites/) para o seu
sistema operacional.

```bash
npm install
npm run tauri dev
```

## Testes

```bash
cd src-tauri
cargo test      # parser do wol.jw.org + balanceador de designações
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

```bash
npm run build    # tsc + build do frontend
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

- `src-tauri/src/wol/` — busca e interpreta a programação semanal em
  wol.jw.org (HTML → estrutura de partes).
- `src-tauri/src/assign/` — regras de elegibilidade por tipo de parte e o
  algoritmo de designação balanceada.
- `src-tauri/src/db.rs` — schema/migrations do SQLite.
- `src/pages/` — Pessoas, Designação (preview + confirmação), Histórico,
  Backup, Configurações e a página de impressão.
