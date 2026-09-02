//! Parser da programação semanal da reunião Vida e Ministério, extraída do
//! HTML publicado em wol.jw.org (biblioteca on-line da Torre de Vigia).
//!
//! O parser é puramente textual (regex sobre o HTML bruto) porque a árvore
//! DOM da página não é uniforme entre as seções (alguns títulos numerados
//! ficam embrulhados em uma `<div>` extra, outros são irmãos diretos), mas
//! as marcações usadas aqui (classes de cor, "N. Título", "(N min)") são
//! estáveis entre semanas — foram conferidas em duas semanas reais.

use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Secao {
    Tesouros,
    Ministerio,
    VidaCrista,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TipoParte {
    Presidente,
    OracaoInicial,
    OracaoFinal,
    Tesouros,
    Joias,
    Leitura,
    MinisterioDiscurso,
    MinisterioDemonstracao,
    VidaCrista,
    VidaCristaAncioes,
    NecessidadesLocais,
    EstudoBiblico,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parte {
    pub ordem: u32,
    pub numero: Option<u32>,
    pub secao: Secao,
    pub titulo: String,
    pub duracao_min: u32,
    pub descricao: String,
    pub tipo: TipoParte,
    pub tem_ajudante: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanaImportada {
    pub intervalo_texto: String,
    pub leitura_semanal: String,
    pub cantico_inicial: Option<u32>,
    pub cantico_meio: Option<u32>,
    pub cantico_final: Option<u32>,
    pub partes: Vec<Parte>,
}

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("não encontrei o docId da apostila Vida e Ministério na página de reuniões")]
    DocIdNaoEncontrado,
    #[error("não encontrei a tag <article> do documento")]
    ArticleNaoEncontrado,
    #[error("não encontrei o cabeçalho (intervalo de datas) do documento")]
    CabecalhoNaoEncontrado,
}

/// Extrai o docId da apostila "Vida e Ministério" a partir do HTML da página
/// `/pt/wol/meetings/r5/lp-t/{ano}/{semana}`. O card correto é o que tem a
/// classe `pub-mwb` (o outro card na mesma página, `pub-w`, é A Sentinela).
pub fn extrair_doc_id(meetings_html: &str) -> Result<String, ParseError> {
    let re = Regex::new(r"\bpub-mwb\s+docId-(\d+)").unwrap();
    re.captures(meetings_html)
        .map(|c| c[1].to_string())
        .ok_or(ParseError::DocIdNaoEncontrado)
}

fn strip_tags(html: &str) -> String {
    let re_tag = Regex::new(r"<[^>]+>").unwrap();
    let sem_tags = re_tag.replace_all(html, " ");
    let re_ws = Regex::new(r"\s+").unwrap();
    html_escape(re_ws.replace_all(&sem_tags, " ").trim())
}

fn html_escape(s: &str) -> String {
    s.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&ldquo;", "\u{201c}")
        .replace("&rdquo;", "\u{201d}")
}

struct Heading {
    start: usize,
    end: usize,
    tag: &'static str, // "h2" | "h3"
    class: String,
    texto: String,
}

fn coletar_headings(article_html: &str) -> Vec<Heading> {
    let re = Regex::new(r#"(?is)<(h2|h3)\b([^>]*)>(.*?)</h[23]>"#).unwrap();
    let re_class = Regex::new(r#"class="([^"]*)""#).unwrap();
    let mut out = Vec::new();
    for m in re.captures_iter(article_html) {
        let whole = m.get(0).unwrap();
        let tag = if &m[1].to_lowercase() == "h2" {
            "h2"
        } else {
            "h3"
        };
        let attrs = &m[2];
        let class = re_class
            .captures(attrs)
            .map(|c| c[1].to_string())
            .unwrap_or_default();
        out.push(Heading {
            start: whole.start(),
            end: whole.end(),
            tag,
            class,
            texto: strip_tags(&m[3]),
        });
    }
    out
}

fn extrair_numero_min(texto: &str) -> (Option<u32>, String) {
    let re = Regex::new(r"^\((\d+)\s*min\.?\)\s*(.*)$").unwrap();
    if let Some(c) = re.captures(texto) {
        let min: u32 = c[1].parse().unwrap_or(0);
        (Some(min), c[2].trim().to_string())
    } else {
        (None, texto.trim().to_string())
    }
}

fn classificar(secao: Secao, titulo: &str, descricao: &str) -> (TipoParte, bool) {
    let titulo_l = titulo.to_lowercase();
    let desc_l = descricao.to_lowercase();
    match secao {
        Secao::Tesouros => {
            if titulo_l.contains("joias espirituais") {
                (TipoParte::Joias, false)
            } else if titulo_l.contains("leitura da bíblia") {
                (TipoParte::Leitura, false)
            } else {
                (TipoParte::Tesouros, false)
            }
        }
        Secao::Ministerio => {
            if desc_l.contains("discurso") {
                (TipoParte::MinisterioDiscurso, false)
            } else {
                (TipoParte::MinisterioDemonstracao, true)
            }
        }
        Secao::VidaCrista => {
            if titulo_l.contains("estudo bíblico de congregação") {
                (TipoParte::EstudoBiblico, false)
            } else if titulo_l.contains("necessidades locais")
                || desc_l.contains("necessidades locais")
            {
                (TipoParte::NecessidadesLocais, false)
            } else if titulo_l.contains("anciã") || desc_l.contains("anciã") {
                (TipoParte::VidaCristaAncioes, false)
            } else {
                (TipoParte::VidaCrista, false)
            }
        }
    }
}

/// Extrai o número do cântico de um texto como "Cântico 27 e oração" ou
/// "Comentários finais (3 min) | Cântico 132 e oração".
fn extrair_cantico(texto: &str) -> Option<u32> {
    let re = Regex::new(r"(?i)Cântico\s+(\d+)").unwrap();
    re.captures(texto).and_then(|c| c[1].parse().ok())
}

/// Faz o parse completo do HTML do documento da apostila (o `<article>` da
/// página `/pt/wol/d/r5/lp-t/{docId}`).
pub fn parse_documento(doc_html: &str) -> Result<SemanaImportada, ParseError> {
    let inicio = doc_html
        .find(r#"id="article""#)
        .and_then(|i| doc_html[i..].find('>').map(|j| i + j + 1))
        .ok_or(ParseError::ArticleNaoEncontrado)?;
    let fim = doc_html[inicio..]
        .find("</article>")
        .map(|i| inicio + i)
        .unwrap_or(doc_html.len());
    let article = &doc_html[inicio..fim];

    let re_header =
        Regex::new(r"(?is)<header>.*?<h1[^>]*>(.*?)</h1>(?:.*?<h2[^>]*>(.*?)</h2>)?.*?</header>")
            .unwrap();
    let (intervalo_texto, leitura_semanal) = match re_header.captures(article) {
        Some(c) => (
            strip_tags(&c[1]),
            c.get(2).map(|m| strip_tags(m.as_str())).unwrap_or_default(),
        ),
        None => return Err(ParseError::CabecalhoNaoEncontrado),
    };

    // Só olhamos o corpo depois do </header> para não confundir cânticos
    // com o restante das marcações.
    let corpo_start = article.find("</header>").map(|i| i + 9).unwrap_or(0);
    let headings = coletar_headings(article);

    let mut secao_atual: Option<Secao> = None;
    let mut cantico_inicial = None;
    let mut cantico_meio = None;
    let mut cantico_final = None;
    let mut partes = Vec::new();
    let mut ordem = 0u32;

    let re_numerado = Regex::new(r"^(\d+)\.\s*(.+)$").unwrap();

    for (i, h) in headings.iter().enumerate() {
        if h.end <= corpo_start {
            continue;
        }
        if h.tag == "h2" {
            if h.class.contains("teal-700") {
                secao_atual = Some(Secao::Tesouros);
            } else if h.class.contains("gold-700") {
                secao_atual = Some(Secao::Ministerio);
            } else if h.class.contains("maroon-600") {
                secao_atual = Some(Secao::VidaCrista);
            }
            continue;
        }

        // h3
        if h.class.contains("dc-icon--music") {
            let cantico = extrair_cantico(&h.texto);
            if secao_atual.is_none() {
                cantico_inicial = cantico;
            } else if secao_atual == Some(Secao::VidaCrista)
                && partes.iter().all(|p: &Parte| p.secao != Secao::VidaCrista)
            {
                cantico_meio = cantico;
            }
            continue;
        }

        if let Some(caps) = re_numerado.captures(&h.texto) {
            let Some(secao) = secao_atual else { continue };
            let numero: u32 = caps[1].parse().unwrap_or(0);
            let titulo = caps[2].trim().to_string();

            // Corpo da parte: do fim deste heading até o início do próximo.
            let fim = headings
                .get(i + 1)
                .map(|h2| h2.start)
                .unwrap_or(article.len());
            let bruto = strip_tags(&article[h.end..fim]);
            let (duracao_min, descricao) = extrair_numero_min(&bruto);
            let duracao_min = duracao_min.unwrap_or(0);

            let (tipo, tem_ajudante) = classificar(secao, &titulo, &descricao);

            ordem += 1;
            partes.push(Parte {
                ordem,
                numero: Some(numero),
                secao,
                titulo,
                duracao_min,
                descricao,
                tipo,
                tem_ajudante,
            });
        } else if h.class.contains("maroon-600")
            || h.texto.to_lowercase().contains("comentários finais")
        {
            // "Comentários finais (3 min) | Cântico 132 e oração"
            if let Some(c) = extrair_cantico(&h.texto) {
                cantico_final = Some(c);
            }
        }
    }

    Ok(SemanaImportada {
        intervalo_texto,
        leitura_semanal,
        cantico_inicial,
        cantico_meio,
        cantico_final,
        partes,
    })
}
