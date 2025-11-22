use std::error::Error;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use directories::ProjectDirs;
use crate::models::AppData;

/// État global de l'application
/// Contient les données de l'application et le chemin du fichier de sauvegarde
/// Utilise un Mutex pour permettre un accès sûr depuis plusieurs threads
/// et gère le chargement et la sauvegarde des données dans un fichier JSON
pub struct AppState {
    pub data: Mutex<AppData>,
    pub file_path: PathBuf,
}

/// Implémentation des méthodes pour AppState
/// Inclut la création de l'état initial et la sauvegarde des données
/// dans un fichier JSON
impl AppState {
    /// Crée une nouvelle instance de AppState
    /// Charge les données depuis le fichier JSON s'il existe,
    /// sinon initialise avec des données vides
    pub fn new() -> Self {
        let proj_dirs = ProjectDirs::from("fr", "vgautier", "mam-plannings").unwrap();
        let data_dir = proj_dirs.data_dir();
        fs::create_dir_all(data_dir).unwrap(); // Crée le dossier s'il n'existe pas
        let file_path = data_dir.join("planning.json");

        let data = if file_path.exists() { // Charge les données depuis le fichier s'il existe
            let content = fs::read_to_string(&file_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or(AppData { days: Vec::new(), team: Vec::new() })
        } else { // Initialise avec des données vides sinon
            AppData { days: Vec::new(), team: Vec::new() }
        };

        // Retourne l'état initialisé
        Self {
            data: Mutex::new(data),
            file_path,
        }
    }

    /// Sauvegarde les données actuelles dans le fichier JSON
    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        let data = self.data.lock().unwrap();
        let json = serde_json::to_string_pretty(&*data)?;
        fs::write(&self.file_path, json)?;
        Ok(())
    }
}