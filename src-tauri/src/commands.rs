use crate::assign::{self, DesignacaoHistorica, DesignacaoResultado, ParteParaDesignar, Pessoa};
use crate::wol::{self, fetch::SemanaComData};

/// Busca no wol.jw.org a programação das próximas `quantidade` semanas da
/// reunião Vida e Ministério. Não toca o banco — a UI decide o que gravar.
#[tauri::command]
pub async fn importar_semanas(quantidade: u32) -> Result<Vec<SemanaComData>, String> {
    wol::buscar_programacao(quantidade)
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
) -> Vec<DesignacaoResultado> {
    assign::gerar_atribuicoes(&pessoas, &historico, &partes)
}
