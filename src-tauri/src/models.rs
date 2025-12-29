use serde::{Deserialize, Serialize};

/// Structure principale contenant les données de l'application
/// Inclut une liste de jours et une équipe d'assistants maternels
/// Utilisée pour stocker et gérer les informations relatives au planning et aux assistants maternels
/// dans l'application
/// - days: Liste des jours avec les détails des enfants et des assistants maternels
/// - team_library: Répertoire global des assistants maternels pour suggérer des noms
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppData {
    pub days: Vec<Day>,
    // Le répertoire global (pour suggérer des noms)
    #[serde(default)]
    pub team_library: Vec<AssistantProfile>,
}

/// Profil d'un assistant maternel
/// Contient un identifiant unique, un nom et une couleur associée
/// Utilisé pour identifier et différencier les assistants maternels dans l'application
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct AssistantProfile {
    pub id: u8,
    pub name: String,
    pub color: String,
}

/// Plage horaire définie par une heure d'arrivée et une heure de départ
/// Les heures sont représentées en minutes depuis minuit
/// Utilisée pour spécifier les horaires des enfants et des assistants maternels
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeRange {
    pub arrivee: u16, // minutes
    pub depart: u16,  // minutes
}

/// Informations sur un enfant, incluant son nom et ses heures de présence
/// Utilisée pour gérer les détails des enfants dans le planning pour un jour donné
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Child {
    pub nom: String,
    pub heures: Vec<TimeRange>,
}

/// Plage horaire d'un assistant maternel pour un jour donné
/// Inclut l'identifiant de l'assistant ainsi que ses heures d'arrivée et de départ
/// Utilisée pour planifier les shifts des assistants maternels
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssistantShift {
    pub am_id: u8,
    pub heures: Vec<TimeRange>,
}

/// Détails d'un jour spécifique dans le planning
/// Inclut la date, le jour de la semaine, la liste des enfants présents et les shifts des assistants maternels
/// Utilisée pour organiser et afficher les informations quotidiennes dans le planning
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Day {
    pub date: String,
    pub jour: String,
    pub enfants: Vec<Child>,
    pub am: Vec<AssistantShift>,
    pub ratio: u8,
}