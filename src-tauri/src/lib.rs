pub mod assign;
mod commands;
mod db;
pub mod wol;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:designacoes.db", db::migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::importar_semanas,
            commands::gerar_atribuicoes,
            commands::salvar_arquivos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
