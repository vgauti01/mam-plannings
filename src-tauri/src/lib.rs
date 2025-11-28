// Déclaration des modules
mod algorithm;
mod commands;
mod models;
mod parsing;
mod state;
mod utils;

use commands::*;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new(); // Initialisation de l'état de l'application

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_planning,
            
            // Gestion Quotidienne
            add_manual_entry,
            remove_child,
            remove_day,
            import_planning_pdf,
            swap_shifts,

            // Gestion Annuaire (Library)
            get_team_library,
            add_assistant,
            update_assistant,
            remove_assistant,

            // Gestion Mois (Settings)
            get_month_config,
            update_month_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}