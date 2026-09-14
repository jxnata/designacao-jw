# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui. O formato
segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento é [semver](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Alterado — conformidade com os termos de uso do jw.org

- **A importação da programação da reunião deixou de acessar a internet.**
  Antes, o app buscava automaticamente o conteúdo das semanas em
  `wol.jw.org` (scraping), o que os termos de uso do site proíbem. Agora o
  usuário baixa o PDF da apostila (*Nossa Vida e Ministério Cristão*) direto
  do jw.org e importa o arquivo no app — o conteúdo é lido do PDF, sem
  nenhuma requisição de rede.
- Na tela de Designação, o controle "Adicionar N semanas / Carregar" foi
  substituído pelo botão **"Adicionar Semanas"**, que abre uma tela nova de
  importação com área de arrastar-e-soltar, botão para selecionar o
  arquivo, indicação de onde baixar o PDF certo (edição em português ou em
  Libras, de acordo com a configuração da congregação) e validação do
  arquivo antes de importar.
- Os dados gravados no banco continuam na mesma estrutura de sempre —
  semanas e partes existentes não são afetadas, e o app permanece
  totalmente retrocompatível.

### Removido

- Todo o módulo de scraping em Rust (`src-tauri/src/wol/`, comando
  `importar_semanas`, dependências `reqwest`/`scraper`/`chrono` usadas só
  por ele) foi removido. O app não faz mais nenhuma requisição HTTP.

## [1.1.0] — 2025

- Landing page com capturas reais de tela e destaque para o app ser
  gratuito.
- Limpeza de designações e marcação de eventos especiais da semana
  (assembleia, congresso, visita, celebração).
- Ajustes de exibição dos nomes de designações em salas adicionais.

## [1.0.0] — 2025

- Suporte a salas adicionais (Sala B e Sala C).
- Edição de designações já geradas e opção de configurar congregação de
  língua de sinais.
- Melhorias de paginação, ícones e ajustes gerais na tela de designações.
- Landing page com deploy no GitHub Pages.

## [0.1.1] e anteriores

- Primeira versão pública: importação da programação semanal, balanceador
  de designações, preview editável, geração de PDFs de designação (S-89) e
  backup/restauração dos dados.
