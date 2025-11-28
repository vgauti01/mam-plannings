use std::collections::HashSet;
use tauri::Manager;
use crate::models::{AssistantProfile, Child, Day, MonthSettings, TimeRange};
use crate::state::AppState;
use crate::algorithm::compute_assistant_shifts;
use crate::parsing::parse_planning;
use crate::utils::to_minutes_from_midnight;

// --- GESTION MOIS ---

/// Extrait la clé du mois à partir d'une date au format "YYYY-MM-DD"
/// # Arguments
/// * `date_str` - Date au format "YYYY-MM-DD"
/// # Returns
/// * `String` - Clé du mois au format "YYYY-MM"
pub(crate) fn get_month_key(date_str: &str) -> String {
    // date_str est "YYYY-MM-DD", on prend les 7 premiers chars
    if date_str.len() >= 7 {
        date_str[0..7].to_string()
    } else {
        "default".to_string()
    }
}

/// Retourne la configuration pour un mois donné
/// # Arguments
/// * `year` - Année (ex: 2025)
/// * `month` - Mois (1-12)
/// # Returns
/// * `MonthSettings` - Paramètres du mois (ratio, équipe active)
#[tauri::command]
pub fn get_month_config(
    state: tauri::State<AppState>,
    year: i32,
    month: u32
) -> MonthSettings {
    let data = state.data.lock().unwrap();
    let key = format!("{}-{:02}", year, month);

    // Si la config existe, on la renvoie
    if let Some(config) = data.month_configs.get(&key) {
        config.clone()
    } else {
        // Sinon, on renvoie une config par défaut (Ratio 4 + toute la librairie)
        // C'est ici qu'on fait la "continuité" par défaut
        MonthSettings {
            ratio: 5,
            active_team: data.team_library.clone(),
        }
    }
}

/// Met à jour la configuration pour un mois donné et recalcule le planning
/// # Arguments
/// * `year` - Année (ex: 2025)
/// * `month` - Mois (1-12)
/// * `ratio` - Nouveau ratio d'enfants par assistant
/// * `active_team` - Nouvelle équipe active pour ce mois
/// # Returns
/// * `Result<Vec<Day>, String>` - Liste mise à jour des jours ou une erreur en cas d'échec
#[tauri::command]
pub fn update_month_config(
    state: tauri::State<AppState>,
    year: i32,
    month: u32,
    ratio: u8,
    active_team: Vec<AssistantProfile>
) -> Result<Vec<Day>, String> {
    let mut data = state.data.lock().unwrap();
    let key = format!("{}-{:02}", year, month);

    // 1. Sauvegarder la nouvelle config
    let new_settings = MonthSettings {
        ratio,
        active_team: active_team.clone(),
    };
    data.month_configs.insert(key.clone(), new_settings);

    // Mettre à jour la librairie globale si on a des nouveaux (optionnel, mais pratique)
    for am in &active_team {
        if !data.team_library.iter().any(|t| t.id == am.id) {
            data.team_library.push(am.clone());
        }
    }

    // 2. RECALCULER TOUT LE MOIS
    // On parcourt tous les jours qui correspondent à ce mois
    for day in data.days.iter_mut() {
        if get_month_key(&day.date) == key {
            // Appel à l'algo avec le NOUVEAU RATIO
            let new_shifts = compute_assistant_shifts(&day.enfants, ratio, &active_team);
            day.am = new_shifts;
        }
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;

    Ok(state.data.lock().unwrap().days.clone())
}

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

    // Récupérer la clé du mois
    let month_key = get_month_key(&date);
    // S'assurer que la config du mois existe
    let ratio = app_data.month_configs.get(&month_key).map(|c| c.ratio).unwrap_or(4);
    let active_team = app_data.month_configs
        .get(&month_key)
        .map(|c| c.active_team.clone())
        .unwrap_or(app_data.team_library.clone());

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
    recalculate_preserving_assignments(day, &active_team, ratio);

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

    // Récupérer la clé du mois
    let month_key = get_month_key(&date);
    // Récupérer le ratio pour ce mois
    let ratio = app_data.month_configs.get(&month_key).map(|c| c.ratio).unwrap_or(4);
    let active_team = app_data.month_configs
        .get(&month_key)
        .map(|c| c.active_team.clone())
        .unwrap_or(app_data.team_library.clone());

    // 2. Trouver le jour correspondant à la date donnée
    if let Some(day) = app_data.days.iter_mut().find(|d| d.date == date) {

        // 3. Supprimer l'enfant
        let len_before = day.enfants.len();
        day.enfants.retain(|c| c.nom != child_name);

        // 4. Recalculer les AMs si un enfant a été supprimé
        if day.enfants.len() < len_before {
            recalculate_preserving_assignments(day, &active_team, ratio);
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
fn recalculate_preserving_assignments(day: &mut Day, active_team: &Vec<AssistantProfile>, ratio: u8) {
    // 1. On sauvegarde l'ordre actuel des AMs (ex: [1, 0] si on a échangé)
    let old_assignments: Vec<u8> = day.am.iter().map(|s| s.am_id).collect();

    // 2. On lance le calcul pur (qui va remettre des IDs 0, 1, 2...)
    let mut new_shifts = compute_assistant_shifts(&day.enfants, ratio, active_team);

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
pub async fn import_planning_pdf(
    app: tauri::AppHandle, // <--- 1. On demande le AppHandle au lieu du State ici
    path: String,
    year: i32
) -> Result<Vec<Day>, String> { // Note: plus besoin de passer 'state' en argument

    // 2. On récupère une copie des configs AVANT de partir dans le thread
    // On a besoin d'accéder au state juste un instant pour lire la config
    let month_configs_snapshot = {
        let state = app.state::<AppState>();
        let data = state.data.lock().unwrap();
        data.month_configs.clone()
    };

    let path_clone = path.clone();
    // 3. On clone l'app handle pour pouvoir l'envoyer dans le thread
    let app_clone = app.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {

        // A. On fait le travail lourd (Parsing) avec la config copiée
        let new_days = parse_planning(&path_clone, year, &month_configs_snapshot)
            .map_err(|e| e.to_string())?;

        // B. MAINTENANT, on récupère l'état À L'INTÉRIEUR du thread grâce au AppHandle
        // C'est la méthode sûre : on redemande l'accès au moment où on en a besoin
        let state = app_clone.state::<AppState>();
        let mut app_data = state.data.lock().unwrap();

        // C. Logique de fusion (Merge)
        for new_day in new_days {
            let month_key = get_month_key(&new_day.date);
            let ratio = app_data.month_configs.get(&month_key).map(|c| c.ratio).unwrap_or(4);
            let active_team = app_data.month_configs
                .get(&month_key)
                .map(|c| c.active_team.clone())
                .unwrap_or(app_data.team_library.clone());


            if let Some(existing_day) = app_data.days.iter_mut().find(|d| d.date == new_day.date) {
                existing_day.enfants = new_day.enfants;
                recalculate_preserving_assignments(existing_day, &active_team, ratio);
            } else {
                let mut day_to_add = new_day;
                day_to_add.am = compute_assistant_shifts(&day_to_add.enfants, ratio, &active_team);
                app_data.days.push(day_to_add);
            }

        }

        app_data.days.sort_by(|a, b| a.date.cmp(&b.date));

        // D. Préparation du retour
        // On clone les données MAINTENANT, car on a déjà l'accès via app_data
        let final_days = app_data.days.clone();

        // E. CRUCIAL : On lâche le verrou AVANT de sauvegarder
        drop(app_data);

        // F. Sauvegarde (qui va reprendre un verrou brièvement en interne)
        state.save().map_err(|e| e.to_string())?;

        // G. Retour
        Ok::<Vec<Day>, String>(final_days)
    }).await;

    result.unwrap_or_else(|_| Err("Le processus d'importation a échoué.".to_string()))
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
    id: usize,
    name: String,
    color: String
) -> Result<Vec<AssistantProfile>, String> {
    let mut data = state.data.lock().unwrap();

    // 1. Mise à jour dans l'annuaire
    if let Some(am) = data.team_library.iter_mut().find(|am| am.id == id) {
        am.name = name.clone();
        am.color = color.clone();
    }

    // 2. (Optionnel mais conseillé) Mise à jour dans les configs de mois existantes
    // Pour que le changement de couleur se répercute partout immédiatement
    for settings in data.month_configs.values_mut() {
        if let Some(am) = settings.active_team.iter_mut().find(|a| a.id == id) {
            am.name = name.clone();
            am.color = color.clone();
        }
    }

    drop(data);
    state.save().map_err(|e| e.to_string())?;
    Ok(state.data.lock().unwrap().team_library.clone())
}

// Supprimer (Archiver) un AM de l'annuaire
#[tauri::command]
pub fn remove_assistant(state: tauri::State<AppState>, id: usize) -> Result<Vec<AssistantProfile>, String> {
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