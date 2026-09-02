#!/usr/bin/env bash
#
# Dispara o build de release (Windows, macOS e Linux) via GitHub Actions.
#
# O workflow .github/workflows/release.yml roda em push de tag "v*".
# Este script sincroniza a versão em todos os manifestos, cria a tag e
# faz o push, o que dispara o workflow automaticamente.
#
# Uso:
#   scripts/release.sh <patch|minor|major|X.Y.Z>
#
# Exemplos:
#   scripts/release.sh patch      # 0.1.0 -> 0.1.1
#   scripts/release.sh minor      # 0.1.0 -> 0.2.0
#   scripts/release.sh 1.4.2      # define versão explícita

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PACKAGE_JSON="package.json"
TAURI_CONF="src-tauri/tauri.conf.json"
CARGO_TOML="src-tauri/Cargo.toml"
CARGO_LOCK="src-tauri/Cargo.lock"

bump=${1:-}
if [[ -z "$bump" ]]; then
  echo "Uso: scripts/release.sh <patch|minor|major|X.Y.Z>" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Erro: 'jq' é necessário e não foi encontrado no PATH." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erro: há alterações não commitadas. Commite ou stash antes de rodar o release." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "master" && "$current_branch" != "main" ]]; then
  echo "Aviso: você está na branch '$current_branch', não em master/main."
  read -r -p "Continuar mesmo assim? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 1
fi

git fetch origin --tags --quiet

current_version="$(jq -r '.version' "$PACKAGE_JSON")"

compute_next_version() {
  local current="$1" kind="$2"
  IFS='.' read -r major minor patch <<<"$current"
  case "$kind" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "$major.$((minor + 1)).0" ;;
    patch) echo "$major.$minor.$((patch + 1))" ;;
    *) echo "$kind" ;;
  esac
}

case "$bump" in
  patch|minor|major)
    new_version="$(compute_next_version "$current_version" "$bump")"
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    new_version="$bump"
    ;;
  *)
    echo "Erro: argumento inválido '$bump'. Use patch, minor, major ou X.Y.Z." >&2
    exit 1
    ;;
esac

tag="v$new_version"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Erro: a tag '$tag' já existe." >&2
  exit 1
fi

echo "Versão atual: $current_version"
echo "Nova versão:  $new_version (tag $tag)"
read -r -p "Confirma o release? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || exit 1

echo "Atualizando $PACKAGE_JSON..."
tmp="$(mktemp)"
jq --arg v "$new_version" '.version = $v' "$PACKAGE_JSON" >"$tmp" && mv "$tmp" "$PACKAGE_JSON"

echo "Atualizando $TAURI_CONF..."
tmp="$(mktemp)"
jq --arg v "$new_version" '.version = $v' "$TAURI_CONF" >"$tmp" && mv "$tmp" "$TAURI_CONF"

echo "Atualizando $CARGO_TOML..."
sed -i.bak -E "0,/^version = \".*\"/s//version = \"$new_version\"/" "$CARGO_TOML"
rm -f "${CARGO_TOML}.bak"

if command -v cargo >/dev/null 2>&1; then
  echo "Atualizando $CARGO_LOCK..."
  (cd src-tauri && cargo update --workspace --offline >/dev/null 2>&1) || \
    (cd src-tauri && cargo generate-lockfile >/dev/null 2>&1) || \
    echo "Aviso: não foi possível atualizar o Cargo.lock automaticamente; ajuste manualmente se necessário."
else
  echo "Aviso: 'cargo' não encontrado; Cargo.lock não foi atualizado."
fi

echo "Rodando npm install para sincronizar package-lock.json..."
npm install --package-lock-only --silent

echo "Commitando alterações de versão..."
git add "$PACKAGE_JSON" package-lock.json "$TAURI_CONF" "$CARGO_TOML" "$CARGO_LOCK"
git commit -m "Bump de versão para $new_version"

echo "Criando tag $tag..."
git tag -a "$tag" -m "Release $new_version"

echo "Enviando commit e tag para origin..."
git push origin "$current_branch"
git push origin "$tag"

echo ""
echo "Tag $tag enviada. O workflow 'Release' foi disparado no GitHub Actions"
echo "e vai buildar para Windows, macOS e Linux, publicando um release draft."
echo "Acompanhe em: https://github.com/jxnata/designacao-jw/actions"
