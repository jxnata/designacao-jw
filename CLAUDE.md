# Release

Para qualquer bump de versão + release, use sempre `scripts/release.sh` —
nunca edite `package.json`/`src-tauri/tauri.conf.json`/`Cargo.toml` à mão
nem faça commit/push de versão manualmente. O script sincroniza a versão em
todos os manifestos (`package.json`, `package-lock.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`),
cria o commit, cria a tag `vX.Y.Z` e dá push do commit + tag — é a tag que
dispara o workflow de release no GitHub Actions (build Windows/macOS/Linux).
Um bump manual sem passar pelo script não cria a tag e não dispara esse
workflow.

```bash
scripts/release.sh <patch|minor|major|X.Y.Z>
```

Escolha o tipo de bump pelo padrão semver, olhando o que de fato mudou desde
a última tag:

- **major**: mudança incompatível — quebra de schema/dados sem migração,
  remoção de funcionalidade, mudança que exige ação do usuário.
- **minor**: nova funcionalidade compatível com o que já existe (ex.: nova
  tela, novo botão/ação, novo campo opcional, nova migration aditiva).
- **patch**: correção de bug, ajuste de UI/copy, refactor sem mudança de
  comportamento visível.

O script já pede confirmação antes de commitar/taguear/dar push — sempre o
deixe rodar interativamente (não use flags para pular a confirmação).
