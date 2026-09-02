pub mod fetch;
pub mod parser;

pub use fetch::{buscar_programacao, WolError};
pub use parser::{extrair_doc_id, Parte, Secao, SemanaImportada, TipoParte};
