use std::collections::HashMap;
use tauri::Manager;
use crate::models::{AssistantProfile, AssistantShift, Child, Day, TimeRange};
use crate::state::AppState;
use crate::algorithm::compute_assistant_shifts_balanced;
use crate::parsing::parse_planning;
use crate::utils::{to_minutes_from_midnight, date_to_weekday_french};

// --- GESTION PLANNING ---

/// Retourne le planning complet (liste des jours)
/// # Returns
/// * `Vec<Day>` - Liste des jours dans le planning
#[tauri::command]
pub fn get_planning(state: tauri::State<AppState>) -> Vec<Day> {
    state.data.lock().unwrap().days.clone()
}

/// Ajoute une entrée manuelle pour un enfant à une date donnée
/// # Arguments
/// * `date` - Date au format "YYYY-MM-DD"
/// * `child_name` - Nom de l'enfant
/// * `arrivee` - Heure d'arrivée au format "HH:MM"
/// * `depart` - Heure de départ au format "HH:MM"
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn add_manual_entry(
    state: tauri::State<AppState>,
    date: String,
    child_name: String,
    arrivee: String,
    depart: String
) -> Result<Vec<Day>, String> {
    // 1. Accéder aux données de l'application
    let mut app_data = state.data.lock().unwrap();

    // 2. Trouver ou créer le jour correspondant à la date donnée
    let day_idx = if let Some(idx) = app_data.days.iter().position(|d| d.date == date) {
        idx
    } else {
        // Calculer le nom du jour de la semaine
        let jour = date_to_weekday_french(&date);

        // Créer les shifts vides pour tous les AM de la librairie
        let am_shifts: Vec<AssistantShift> = app_data.team_library.iter()
            .map(|am| AssistantShift { am_id: am.id, heures: Vec::new() })
            .collect();

        // Utiliser le ratio par défaut (chercher dans les jours existants ou 4)
        let ratio = app_data.days.first().map(|d| d.ratio).unwrap_or(4);

        let new_day = Day {
            date: date.clone(),
            jour,
            enfants: Vec::new(),
            am: am_shifts,
            ratio,
        };
        app_data.days.push(new_day);

        // Trier les jours par date
        app_data.days.sort_by(|a, b| a.date.cmp(&b.date));

        // Retrouver l'index après le tri
        app_data.days.iter().position(|d| d.date == date).unwrap()
    };

    // 3. Ajouter l'enfant et sa plage horaire
    let day = &mut app_data.days[day_idx];
    let arrivee_min = to_minutes_from_midnight(&arrivee);
    let depart_min = to_minutes_from_midnight(&depart);
    let range = TimeRange::new(arrivee_min, depart_min)?;

    // 4. Vérifier si l'enfant existe déjà pour ce jour, et ajouter la plage horaire
    if let Some(child) = day.enfants.iter_mut().find(|c| c.nom == child_name) {
        child.heures.push(range);
    } else {
        day.enfants.push(Child { nom: child_name, heures: vec![range] });
    }

    // 5. Sauvegarder les données
    drop(app_data); // On libère le mutex avant l'I/O
    state.save().map_err(|e| e.to_string())?; // Sauvegarde

    // 6. Retourner la liste mise à jour des jours
    Ok(state.data.lock().unwrap().days.clone())
}

/// Supprime un enfant d'un jour donné
/// # Arguments
/// * `date` - Date au format "YYYY-MM-DD"
/// * `child_name` - Nom de l'enfant à supprimer
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn remove_child(
    state: tauri::State<AppState>,
    date: String,       // "2025-11-03"
    child_name: String  // "Jean D."
) -> Result<Vec<Day>, String> {
    // 1. Accéder aux données de l'application
    let mut app_data = state.data.lock().unwrap();

    // 2. Trouver le jour correspondant à la date donnée
    if let Some(day) = app_data.days.iter_mut().find(|d| d.date == date) {

        // 3. Supprimer l'enfant
        day.enfants.retain(|c| c.nom != child_name);
    }

    // 4. Sauvegarder les données
    drop(app_data); // On libère le mutex avant l'I/O
    state.save().map_err(|e| e.to_string())?;

    // 5. Retourne la liste mise à jour
    Ok(state.data.lock().unwrap().days.clone())
}

/// Supprime un jour entier du planning
/// # Arguments
/// * `date` - Date au format "YYYY-MM-DD"
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn remove_day(
    state: tauri::State<AppState>,
    date: String
) -> Result<Vec<Day>, String> {
    let mut app_data = state.data.lock().unwrap();

    // On garde tous les jours SAUF celui qui correspond à la date donnée
    app_data.days.retain(|d| d.date != date);

    drop(app_data);
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

/// Importe un planning depuis un fichier PDF
/// # Arguments
/// * `path` - Chemin vers le fichier PDF
/// * `year` - Année à utiliser pour les dates
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub async fn import_planning_pdf(
    app: tauri::AppHandle,
    path: String,
    year: i32,
    ratio: u8,
    active_team_ids: Vec<u8>
) -> Result<Vec<Day>, String> {

    // 1. ISOLATION DANS UN BLOC
    // On crée 'active_team' dans ce bloc. Une fois l'accolade fermante atteinte,
    // le MutexGuard (app_data) est DÉTRUIT. Il n'existe plus quand on arrive au .await.
    let active_team: Vec<AssistantProfile> = {
        let state = app.state::<AppState>();
        let app_data = state.data.lock().unwrap();

        app_data.team_library.iter()
            .filter(|am| active_team_ids.contains(&am.id))
            .cloned()
            .collect()
    }; // <--- Ici, app_data meurt. Le verrou est lâché.

    let path_clone = path.clone();
    // 2. On clone l'app handle pour pouvoir l'envoyer dans le thread
    let app_clone = app.clone();

    // ICI commence l'attente asynchrone (.await).
    // Comme app_data est mort plus haut, Rust est content !
    let result = tauri::async_runtime::spawn_blocking(move || {

        // A. Parsing
        let mut new_days = parse_planning(&path_clone, year, ratio, &active_team)
            .map_err(|e| e.to_string())?;

        // B. Trier les jours par date pour traiter dans l'ordre chronologique
        new_days.sort_by(|a, b| a.date.cmp(&b.date));

        // C. Calculer les shifts avec équilibrage sur le mois
        // On accumule les heures jour par jour pour équilibrer
        let mut accumulated_hours: HashMap<u8, u32> = HashMap::new();

        for day in &mut new_days {
            // Calculer les shifts en tenant compte des heures déjà accumulées
            day.am = compute_assistant_shifts_balanced(&day.enfants, ratio, &active_team, &accumulated_hours);

            // Mettre à jour les heures accumulées avec ce jour
            for shift in &day.am {
                let day_minutes: u32 = shift.heures.iter()
                    .map(|r| (r.depart - r.arrivee) as u32)
                    .sum();
                *accumulated_hours.entry(shift.am_id).or_insert(0) += day_minutes;
            }
        }

        // D. On récupère l'état À L'INTÉRIEUR du thread
        let state = app_clone.state::<AppState>();
        let mut app_data = state.data.lock().unwrap();

        // E. Logique de fusion (Merge)
        for new_day in new_days {
            if let Some(existing_day) = app_data.days.iter_mut().find(|d| d.date == new_day.date) {
                existing_day.enfants = new_day.enfants;
                existing_day.am = new_day.am; // Utiliser les shifts déjà calculés avec équilibrage
            } else {
                app_data.days.push(new_day);
            }
        }

        app_data.days.sort_by(|a, b| a.date.cmp(&b.date));

        // F. Préparation du retour (Clonage avant drop)
        let final_days = app_data.days.clone();

        // G. CRUCIAL : On lâche le verrou AVANT de sauvegarder
        drop(app_data);

        // H. Sauvegarde
        state.save().map_err(|e| e.to_string())?;

        // I. Retour
        Ok::<Vec<Day>, String>(final_days)
    }).await;

    result.unwrap_or_else(|e| Err(format!("Erreur lors de l'importation: {:?}", e)))
}

// --- GESTION DE L'ANNUAIRE (LIBRARY) ---

// Récupérer tout l'annuaire (pour l'afficher dans la modale de sélection)
#[tauri::command]
pub fn get_team_library(state: tauri::State<AppState>) -> Vec<AssistantProfile> {
    state.data.lock().unwrap().team_library.clone()
}

// Ajouter un AM dans l'annuaire global
#[tauri::command]
pub fn add_assistant(
    state: tauri::State<AppState>,
    name: String,
    color: String
) -> Result<Vec<AssistantProfile>, String> {
    let mut data = state.data.lock().unwrap();

    // Calcul d'ID robuste (basé sur le max de la librairie)
    let new_id = data.team_library.iter()
        .map(|am| am.id)
        .max()
        .unwrap_or(0) + 1;

    let final_id = if data.team_library.is_empty() { 0 } else { new_id };

    let new_am = AssistantProfile { id: final_id, name, color };
    data.team_library.push(new_am);

    drop(data);
    state.save().map_err(|e| e.to_string())?;

    // On retourne la librairie à jour
    Ok(state.data.lock().unwrap().team_library.clone())
}

// Modifier un AM (Nom/Couleur)
#[tauri::command]
pub fn update_assistant(
    state: tauri::State<AppState>,
    id: u8,
    name: String,
    color: String
) -> Result<Vec<AssistantProfile>, String> {
    let mut data = state.data.lock().unwrap();

    // 1. Mise à jour dans l'annuaire
    if let Some(am) = data.team_library.iter_mut().find(|am| am.id == id) {
        am.name = name.clone();
        am.color = color.clone();
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team_library.clone())
}

// Supprimer (Archiver) un AM de l'annuaire
#[tauri::command]
pub fn remove_assistant(state: tauri::State<AppState>, id: u8) -> Result<Vec<AssistantProfile>, String> {
    let mut data = state.data.lock().unwrap();

    // On le retire seulement de la librairie (les vieux plannings garderont la trace via month_configs)
    data.team_library.retain(|am| am.id != id);

    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team_library.clone())
}

// --- LOGIQUE D'ÉCHANGE ---

/// Échange les shifts de deux assistants maternels pour un jour donné
/// # Arguments
/// * `date` - Date au format "YYYY-MM-DD"
/// * `am_id_1` - Identifiant du premier assistant maternel
/// * `am_id_2` - Identifiant du second assistant maternel
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn swap_shifts(
    state: tauri::State<AppState>,
    date: String,
    am_id_1: u8,
    am_id_2: u8
) -> Result<Vec<Day>, String> {
    // Accéder aux données de l'application
    let mut data = state.data.lock().unwrap();

    // Trouver le jour correspondant à la date donnée
    if let Some(day) = data.days.iter_mut().find(|d| d.date == date) {
        // On parcourt tous les shifts du jour
        for shift in day.am.iter_mut() {
            if shift.am_id == am_id_1 {
                shift.am_id = am_id_2;
            } else if shift.am_id == am_id_2 {
                shift.am_id = am_id_1;
            }
        }
        // Note : L'algorithme de recalcul automatique n'est PAS appelé ici
        // sinon il remettrait tout dans l'ordre "logique" (optimisé).
        // On fait confiance à l'utilisateur pour cet échange manuel.
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

#[tauri::command]
pub fn edit_assistant_shift(
    state: tauri::State<AppState>,
    date: String,
    am_id: u8,
    new_ranges: Vec<TimeRange>
) -> Result<Vec<Day>, String> {
    // Accéder aux données de l'application
    let mut data = state.data.lock().unwrap();

    // Trouver le jour correspondant à la date donnée
    if let Some(day) = data.days.iter_mut().find(|d| d.date == date) {
        // Trouver le shift de l'assistant maternel ou le créer
        if let Some(shift) = day.am.iter_mut().find(|s| s.am_id == am_id) {
            shift.heures = new_ranges;
        } else {
            // Créer un nouveau shift pour cet AM
            day.am.push(AssistantShift {
                am_id,
                heures: new_ranges,
            });
        }
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

/// Modifie le ratio enfants/AM pour un jour spécifique
/// # Arguments
/// * `date` - Date au format "YYYY-MM-DD"
/// * `ratio` - Nouveau ratio (ex: 4 = 4 enfants par AM)
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn update_day_ratio(
    state: tauri::State<AppState>,
    date: String,
    ratio: u8
) -> Result<Vec<Day>, String> {
    let mut data = state.data.lock().unwrap();

    if let Some(day) = data.days.iter_mut().find(|d| d.date == date) {
        day.ratio = ratio;
    } else {
        return Err(format!("Jour non trouvé: {}", date));
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

