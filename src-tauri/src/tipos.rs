//! Tipos de domínio compartilhados pelo balanceador de designações
//! (`assign/`). O parser da apostila (PDF) roda inteiramente no frontend,
//! em `src/lib/mwb/`, e usa a mesma lista de variantes — os nomes aqui
//! (serializados em `snake_case`) precisam continuar batendo com
//! `TipoParte` em `src/lib/types.ts`.

use serde::{Deserialize, Serialize};

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
    MinisterioConsideracao,
    VidaCrista,
    VidaCristaAncioes,
    NecessidadesLocais,
    EstudoBiblico,
}
