# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui. O formato
segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento é [semver](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [2.0.0] — 2026-09-14

### Adicionado

- **Importação da apostila em `.jwpub`**, o mesmo arquivo que o JW Library
  usa — baixado da mesma página do jw.org, é o formato **recomendado** por
  ser dado estruturado (o PDF exige recompor colunas e acentos a partir da
  posição do texto na página, o que o `.jwpub` dispensa). O PDF continua
  funcionando normalmente como alternativa. Implementado com a lib
  [`meeting-schedules-parser`](https://github.com/sws2apps/meeting-schedules-parser)
  (MIT), que lê o SQLite dentro do `.jwpub` (zip aninhado, decriptado com
  `crypto.subtle`) inteiramente no dispositivo do usuário — sem rede.
  - O arquivo `.jwpub` precisa manter o nome original do download (ex.:
    `mwb_T_202601.jwpub`) — é dele que o app identifica o idioma/edição; um
    arquivo renomeado gera um erro explicativo pedindo para baixar de novo.
  - Suporta as edições em português (`T`) e em Libras (`LSB`), com o mesmo
    aviso não bloqueante de edição errada que o PDF já tinha.

### Alterado — conformidade com os termos de uso do jw.org

- **A importação da programação da reunião deixou de acessar a internet.**
  Antes, o app buscava automaticamente o conteúdo das semanas em
  `wol.jw.org` (scraping), o que os termos de uso do site proíbem. Agora o
  usuário baixa o PDF da apostila (_Nossa Vida e Ministério Cristão_) direto
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

## [1.1.0] — 2026

- Landing page com capturas reais de tela e destaque para o app ser
  gratuito.
- Limpeza de designações e marcação de eventos especiais da semana
  (assembleia, congresso, visita, celebração).
- Ajustes de exibição dos nomes de designações em salas adicionais.

## [1.0.0] — 2026

- Suporte a salas adicionais (Sala B e Sala C).
- Edição de designações já geradas e opção de configurar congregação de
  língua de sinais.
- Melhorias de paginação, ícones e ajustes gerais na tela de designações.
- Landing page com deploy no GitHub Pages.

## [0.1.1] e anteriores

- Primeira versão pública: importação da programação semanal, balanceador
  de designações, preview editável, geração de PDFs de designação (S-89) e
  backup/restauração dos dados.
