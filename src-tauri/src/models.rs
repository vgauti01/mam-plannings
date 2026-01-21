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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_range_serialize() {
        let range = TimeRange { arrivee: 480, depart: 1020 };
        let json = serde_json::to_string(&range).unwrap();
        assert!(json.contains("480"));
        assert!(json.contains("1020"));
    }

    #[test]
    fn test_time_range_deserialize() {
        let json = r#"{"arrivee": 480, "depart": 1020}"#;
        let range: TimeRange = serde_json::from_str(json).unwrap();
        assert_eq!(range.arrivee, 480);
        assert_eq!(range.depart, 1020);
    }

    #[test]
    fn test_child_serialize() {
        let child = Child {
            nom: "Alice".to_string(),
            heures: vec![TimeRange { arrivee: 480, depart: 1020 }],
        };
        let json = serde_json::to_string(&child).unwrap();
        assert!(json.contains("Alice"));
        assert!(json.contains("480"));
    }

    #[test]
    fn test_child_deserialize() {
        let json = r#"{"nom": "Alice", "heures": [{"arrivee": 480, "depart": 1020}]}"#;
        let child: Child = serde_json::from_str(json).unwrap();
        assert_eq!(child.nom, "Alice");
        assert_eq!(child.heures.len(), 1);
        assert_eq!(child.heures[0].arrivee, 480);
    }

    #[test]
    fn test_assistant_profile_serialize() {
        let profile = AssistantProfile {
            id: 0,
            name: "Marie".to_string(),
            color: "#FF0000".to_string(),
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(json.contains("Marie"));
        assert!(json.contains("#FF0000"));
    }

    #[test]
    fn test_assistant_profile_equality() {
        let profile1 = AssistantProfile {
            id: 0,
            name: "Marie".to_string(),
            color: "#FF0000".to_string(),
        };
        let profile2 = AssistantProfile {
            id: 0,
            name: "Marie".to_string(),
            color: "#FF0000".to_string(),
        };
        assert_eq!(profile1, profile2);
    }

    #[test]
    fn test_assistant_shift_serialize() {
        let shift = AssistantShift {
            am_id: 0,
            heures: vec![
                TimeRange { arrivee: 480, depart: 720 },
                TimeRange { arrivee: 840, depart: 1020 },
            ],
        };
        let json = serde_json::to_string(&shift).unwrap();
        assert!(json.contains("am_id"));
        assert!(json.contains("480"));
        assert!(json.contains("840"));
    }

    #[test]
    fn test_day_serialize() {
        let day = Day {
            date: "2025-01-06".to_string(),
            jour: "Lundi".to_string(),
            enfants: vec![],
            am: vec![],
            ratio: 4,
        };
        let json = serde_json::to_string(&day).unwrap();
        assert!(json.contains("2025-01-06"));
        assert!(json.contains("Lundi"));
        assert!(json.contains("ratio"));
    }

    #[test]
    fn test_day_deserialize() {
        let json = r#"{
            "date": "2025-01-06",
            "jour": "Lundi",
            "enfants": [],
            "am": [],
            "ratio": 4
        }"#;
        let day: Day = serde_json::from_str(json).unwrap();
        assert_eq!(day.date, "2025-01-06");
        assert_eq!(day.jour, "Lundi");
        assert_eq!(day.ratio, 4);
    }

    #[test]
    fn test_app_data_serialize() {
        let app_data = AppData {
            days: vec![],
            team_library: vec![
                AssistantProfile {
                    id: 0,
                    name: "Marie".to_string(),
                    color: "#FF0000".to_string(),
                },
            ],
        };
        let json = serde_json::to_string(&app_data).unwrap();
        assert!(json.contains("days"));
        assert!(json.contains("team_library"));
        assert!(json.contains("Marie"));
    }

    #[test]
    fn test_app_data_default_team_library() {
        // Test que team_library a une valeur par défaut si absente du JSON
        let json = r#"{"days": []}"#;
        let app_data: AppData = serde_json::from_str(json).unwrap();
        assert!(app_data.team_library.is_empty());
    }

    #[test]
    fn test_child_multiple_time_ranges() {
        let child = Child {
            nom: "Alice".to_string(),
            heures: vec![
                TimeRange { arrivee: 480, depart: 720 },
                TimeRange { arrivee: 840, depart: 1020 },
            ],
        };
        assert_eq!(child.heures.len(), 2);
        assert_eq!(child.heures[0].arrivee, 480);
        assert_eq!(child.heures[1].arrivee, 840);
    }

    #[test]
    fn test_complete_day_with_data() {
        let day = Day {
            date: "2025-01-06".to_string(),
            jour: "Lundi".to_string(),
            enfants: vec![
                Child {
                    nom: "Alice".to_string(),
                    heures: vec![TimeRange { arrivee: 480, depart: 1020 }],
                },
                Child {
                    nom: "Bob".to_string(),
                    heures: vec![TimeRange { arrivee: 540, depart: 960 }],
                },
            ],
            am: vec![
                AssistantShift {
                    am_id: 0,
                    heures: vec![TimeRange { arrivee: 480, depart: 1020 }],
                },
            ],
            ratio: 4,
        };

        let json = serde_json::to_string(&day).unwrap();
        let parsed: Day = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.enfants.len(), 2);
        assert_eq!(parsed.am.len(), 1);
        assert_eq!(parsed.enfants[0].nom, "Alice");
        assert_eq!(parsed.am[0].am_id, 0);
    }
}