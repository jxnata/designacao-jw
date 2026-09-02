use crate::assign::{
    self, ConfiguracaoDesignacao, DesignacaoHistorica, DesignacaoResultado, ParteParaDesignar,
    Pessoa,
};
use crate::wol::{self, fetch::SemanaComData};

/// Busca no wol.jw.org a programação das próximas `quantidade` semanas da
/// reunião Vida e Ministério. Não toca o banco — a UI decide o que gravar.
/// Quando `ano_apos`/`semana_iso_apos` são informados (ano + semana ISO de
/// uma semana já importada), a busca começa na semana seguinte a ela, em
/// vez da semana corrente — usado pelo botão "adicionar semana".
#[tauri::command]
pub async fn importar_semanas(
    quantidade: u32,
    ano_apos: Option<i32>,
    semana_iso_apos: Option<u32>,
) -> Result<Vec<SemanaComData>, String> {
    let apos = ano_apos.zip(semana_iso_apos);
    wol::buscar_programacao(quantidade, apos)
        .await
        .map_err(|e| e.to_string())
}

/// Roda o algoritmo de designação balanceada sobre as partes informadas,
/// usando o histórico já confirmado para manter o equilíbrio entre pessoas.
/// Função pura: não lê nem grava nada — a UI monta o histórico/partes a
/// partir do SQLite (via `tauri-plugin-sql`) e grava o resultado do mesmo
/// jeito.
#[tauri::command]
pub fn gerar_atribuicoes(
    pessoas: Vec<Pessoa>,
    historico: Vec<DesignacaoHistorica>,
    partes: Vec<ParteParaDesignar>,
    config: ConfiguracaoDesignacao,
) -> Vec<DesignacaoResultado> {
    assign::gerar_atribuicoes(&pessoas, &historico, &partes, config)
}
