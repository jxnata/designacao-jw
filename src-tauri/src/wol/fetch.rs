use chrono::{Datelike, Duration, Local, NaiveDate};
use serde::Serialize;

use super::parser::{self, ParseError, SemanaImportada};

const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

#[derive(Debug, thiserror::Error)]
pub enum WolError {
    #[error("erro de rede ao acessar wol.jw.org: {0}")]
    Rede(#[from] reqwest::Error),
    #[error("erro ao interpretar a página: {0}")]
    Parse(#[from] ParseError),
}

#[derive(Debug, Clone, Serialize)]
pub struct SemanaComData {
    pub ano: i32,
    pub semana_iso: u32,
    pub doc_id: String,
    #[serde(flatten)]
    pub semana: SemanaImportada,
}

/// Busca a programação das próximas `quantidade` semanas (a partir da semana
/// corrente), navegando `wol.jw.org` exatamente como um navegador faria:
/// primeiro a página de reuniões da semana (que aponta o docId da apostila),
/// depois o documento em si.
pub async fn buscar_programacao(quantidade: u32) -> Result<Vec<SemanaComData>, WolError> {
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build()?;

    let mut resultado = Vec::with_capacity(quantidade as usize);
    let mut data = Local::now().date_naive();

    for _ in 0..quantidade {
        let iso = data.iso_week();
        let (ano, semana_iso) = (iso.year(), iso.week());

        let semana = buscar_semana(&client, ano, semana_iso).await?;
        resultado.push(semana);

        data = proxima_segunda(data);
    }

    Ok(resultado)
}

fn proxima_segunda(data: NaiveDate) -> NaiveDate {
    // Avança para a segunda-feira da semana ISO seguinte, garantindo que o
    // cálculo do iso_week() da próxima iteração não fique preso na mesma
    // semana por causa de fusos/horas.
    let segunda_atual = data - Duration::days(data.weekday().num_days_from_monday() as i64);
    segunda_atual + Duration::days(7)
}

async fn buscar_semana(
    client: &reqwest::Client,
    ano: i32,
    semana_iso: u32,
) -> Result<SemanaComData, WolError> {
    let url_semana = format!("https://wol.jw.org/pt/wol/meetings/r5/lp-t/{ano}/{semana_iso}");
    let meetings_html = client.get(&url_semana).send().await?.text().await?;
    let doc_id = parser::extrair_doc_id(&meetings_html)?;

    let url_doc = format!("https://wol.jw.org/pt/wol/d/r5/lp-t/{doc_id}");
    let doc_html = client.get(&url_doc).send().await?.text().await?;
    let semana = parser::parse_documento(&doc_html)?;

    Ok(SemanaComData {
        ano,
        semana_iso,
        doc_id,
        semana,
    })
}
