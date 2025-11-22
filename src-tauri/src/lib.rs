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
            add_manual_entry,
            import_planning_pdf,
            remove_child,
            remove_day,
            get_team,
            add_assistant,
            update_assistant,
            remove_assistant,
            swap_shifts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}