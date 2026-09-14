use crate::assign::{
    self, ConfiguracaoDesignacao, DesignacaoHistorica, DesignacaoResultado, ParteParaDesignar,
    Pessoa,
};
use serde::Deserialize;
use std::path::{Path, PathBuf};

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

/// Um arquivo a gravar dentro da pasta escolhida pelo usuário, com caminho
/// relativo a ela (pode incluir subpastas, ex.: "S-89 - 7-13 de set/arquivo.pdf").
#[derive(Deserialize)]
pub struct ArquivoSaida {
    pub caminho_relativo: String,
    pub bytes: Vec<u8>,
}

/// Grava os S-89 (ou qualquer outro arquivo binário gerado no
/// frontend) numa pasta arbitrária escolhida pelo usuário no diálogo de
/// sistema. Existe porque o `fs:scope` do plugin-fs só libera `$APPDATA`,
/// `$DOCUMENT` e `$DOWNLOAD` — uma pasta fora dessas seria negada — e o
/// plugin-fs não tem `allow-write-file` para binário de qualquer forma.
/// `caminho_relativo` é sempre gerado por nós (nome de arquivo/semana), mas
/// validamos contra `..`/raiz absoluta mesmo assim, por segurança.
#[tauri::command]
pub fn salvar_arquivos(pasta: String, arquivos: Vec<ArquivoSaida>) -> Result<usize, String> {
    let base = PathBuf::from(&pasta);
    let mut gravados = 0usize;

    for arquivo in &arquivos {
        let relativo = Path::new(&arquivo.caminho_relativo);
        if relativo.is_absolute() || relativo.components().any(|c| c.as_os_str() == "..") {
            return Err(format!(
                "Caminho relativo inválido: {}",
                arquivo.caminho_relativo
            ));
        }

        let destino = base.join(relativo);
        if let Some(pai) = destino.parent() {
            std::fs::create_dir_all(pai)
                .map_err(|e| format!("Falha ao criar pasta {}: {e}", pai.display()))?;
        }
        std::fs::write(&destino, &arquivo.bytes)
            .map_err(|e| format!("Falha ao gravar {}: {e}", destino.display()))?;
        gravados += 1;
    }

    Ok(gravados)
}
