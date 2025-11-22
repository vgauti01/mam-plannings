use std::collections::HashSet;
use crate::models::{AssistantProfile, Child, Day, TimeRange};
use crate::state::AppState;
use crate::algorithm::compute_assistant_shifts;
use crate::parsing::parse_planning;
use crate::utils::to_minutes_from_midnight;

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
        let new_day = Day {
            date: date.clone(),
            jour: "Inconnu".to_string(),
            enfants: Vec::new(),
            am: Vec::new(),
        };
        app_data.days.push(new_day);
        app_data.days.len() - 1
    };

    // 3. Ajouter l'enfant et sa plage horaire
    let day = &mut app_data.days[day_idx];
    let range = TimeRange {
        arrivee: to_minutes_from_midnight(&arrivee),
        depart: to_minutes_from_midnight(&depart),
    };

    // 4. Vérifier si l'enfant existe déjà pour ce jour, et ajouter la plage horaire
    if let Some(child) = day.enfants.iter_mut().find(|c| c.nom == child_name) {
        child.heures.push(range);
    } else {
        day.enfants.push(Child { nom: child_name, heures: vec![range] });
    }

    // 5. Recalculer les AMs pour ce jour
    recalculate_preserving_assignments(day);

    // 6. Sauvegarder les données
    drop(app_data); // On libère le mutex avant l'I/O
    state.save().map_err(|e| e.to_string())?; // Sauvegarde

    // 7. Retourner la liste mise à jour des jours
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
        let len_before = day.enfants.len();
        day.enfants.retain(|c| c.nom != child_name);

        // 4. Recalculer les AMs si un enfant a été supprimé
        if day.enfants.len() < len_before {
            recalculate_preserving_assignments(day);
        }
    }

    // 5. Sauvegarder les données
    drop(app_data); // On libère le mutex avant l'I/O
    state.save().map_err(|e| e.to_string())?;

    // 6. Retourne la liste mise à jour
    Ok(state.data.lock().unwrap().days.clone())
}

/// Recalcule les shifts mais essaye de garder les IDs des AMs aux mêmes positions
/// # Arguments
/// * `day` - Jour à recalculer
fn recalculate_preserving_assignments(day: &mut Day) {
    // 1. On sauvegarde l'ordre actuel des AMs (ex: [1, 0] si on a échangé)
    let old_assignments: Vec<usize> = day.am.iter().map(|s| s.am_id).collect();

    // 2. On lance le calcul pur (qui va remettre des IDs 0, 1, 2...)
    let mut new_shifts = compute_assistant_shifts(&day.enfants, 4);

    // 3. On prépare un set pour éviter les doublons d'ID
    let mut used_ids = HashSet::new();

    // 4. Réapplication des anciens IDs sur les nouveaux shifts
    for (i, shift) in new_shifts.iter_mut().enumerate() {
        if i < old_assignments.len() {
            // Si ce slot existait déjà, on remet la personne qui y était
            shift.am_id = old_assignments[i];
        }

        // Gestion de conflit : Si on a rajouté un shift (ex: besoin de 3 AM au lieu de 2),
        // l'algo a peut-être donné l'ID 1, mais l'ID 1 est peut-être déjà pris par le slot 0 forcé.
        // On cherche le prochain ID libre.
        while used_ids.contains(&shift.am_id) {
            shift.am_id += 1;
        }

        // On marque cet ID comme utilisé
        used_ids.insert(shift.am_id);
    }

    // 5. On applique le résultat
    day.am = new_shifts;
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
pub async fn import_planning_pdf(path: String, year: i32, state: tauri::State<'_, AppState>) -> Result<Vec<Day>, String> {
    // Cloner le path pour le déplacer dans le contexte bloquant
    let path_clone = path.clone();
    // Parser le planning dans un contexte bloquant
    let parsed = tauri::async_runtime::spawn_blocking(move || {
        parse_planning(&path_clone, year).map_err(|e| e.to_string())
    }).await;
    // Cloner dans un contexte async pour éviter les captures 'static

    // Gérer les erreurs de parsing
    let new_days = match parsed {
        Ok(Ok(days)) => days,
        Ok(Err(e)) => return Err(e),
        Err(_) => return Err("Le processus d'importation a été interrompu ou a planté.".to_string()),
    };

    // Merging des jours importés avec les jours existants
    {
        let mut app_data = state.data.lock().unwrap();

        // Pour chaque jour importé
        for new_day in new_days {
            // Si le jour existe déjà, on met à jour les enfants et on recalcule
            if let Some(existing_day) = app_data.days.iter_mut().find(|d| d.date == new_day.date) {
                existing_day.enfants = new_day.enfants;
                recalculate_preserving_assignments(existing_day);
            } else {
                // Sinon, on ajoute le nouveau jour tel quel
                app_data.days.push(new_day);
            }
        }

        app_data.days.sort_by(|a, b| a.date.cmp(&b.date));
        // mutex guard dropped here
    }

    // Persist (call save). If this is blocking and you must avoid blocking the async runtime,
    // wrap the save in spawn_blocking similarly — but avoid moving non-'static references into it.
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

// --- GESTION ÉQUIPE ---

/// Retourne la liste des assistants maternels
/// # Returns
/// * `Vec<AssistantProfile>` - Liste des profils des assistants maternels
#[tauri::command]
pub fn get_team(state: tauri::State<AppState>) -> Vec<AssistantProfile> {
    // Retourne la liste des assistants maternels
    state.data.lock().unwrap().team.clone()
}

/// Ajoute un nouvel assistant maternel à l'équipe
/// # Arguments
/// * `name` - Nom de l'assistant maternel
/// * `color` - Couleur associée à l'assistant maternel
/// # Returns
/// * `Result<Vec<AssistantProfile>, String>` - Liste mise à jour des profils ou une erreur en cas d'échec
#[tauri::command]
pub fn add_assistant(state: tauri::State<AppState>, name: String, color: String) -> Result<Vec<AssistantProfile>, String> {
    // Accéder aux données de l'application
    let mut data = state.data.lock().unwrap();

    // Générer un nouvel ID unique
    let new_id = data.team.iter()
        .map(|am| am.id)
        .max()
        .unwrap_or(0)
        + 1;

    // Si c'est le premier AM, on lui donne l'ID 0 pour simplifier
    let final_id = if data.team.is_empty() { 0 } else { new_id };

    // Ajouter le nouvel assistant maternel
    data.team.push(AssistantProfile { id: final_id, name, color });

    // Sauvegarder les données
    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team.clone())
}

/// Met à jour les informations d'un assistant maternel existant
/// # Arguments
/// * `id` - Identifiant de l'assistant maternel à mettre à jour
/// * `name` - Nouveau nom de l'assistant maternel
/// * `color` - Nouvelle couleur associée à l'assistant maternel
/// # Returns
/// * `Result<Vec<AssistantProfile>, String>` - Liste mise à jour des profils ou une erreur en cas d'échec
#[tauri::command]
pub fn update_assistant(
    state: tauri::State<AppState>,
    id: usize,
    name: String,
    color: String
) -> Result<Vec<AssistantProfile>, String> {
    // Accéder aux données de l'application
    let mut data = state.data.lock().unwrap();

    // Trouver et mettre à jour l'assistant maternel
    if let Some(am) = data.team.iter_mut().find(|am| am.id == id) {
        am.name = name;
        am.color = color;
    }

    // Sauvegarder les données
    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team.clone())
}

/// Supprime un assistant maternel de l'équipe
/// # Arguments
/// * `id` - Identifiant de l'assistant maternel à supprimer
/// # Returns
/// * `Result<Vec<AssistantProfile>, String>` - Liste mise à jour des profils ou une erreur en cas d'échec
#[tauri::command]
pub fn remove_assistant(state: tauri::State<AppState>, id: usize) -> Result<Vec<AssistantProfile>, String> {
    let mut data = state.data.lock().unwrap();

    data.team.retain(|am| am.id != id);

    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team.clone())
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
    am_id_1: usize,
    am_id_2: usize
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