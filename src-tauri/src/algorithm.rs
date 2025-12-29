use std::collections::HashMap;
use crate::models::{AssistantProfile, AssistantShift, Child, TimeRange};

/// Structure interne représentant un segment de temps avec le nombre d'AM nécessaires
struct Segment {
    start: u16,
    end: u16,
    am_needed: u8,
}

/// Calcule les shifts des assistants maternels pour une liste d'enfants donnée
/// avec équilibrage des heures entre les AM.
///
/// L'algorithme favorise les AM avec le moins d'heures accumulées pour les nouveaux shifts,
/// et retire en priorité ceux qui ont le plus d'heures quand on doit réduire le nombre d'AM.
///
/// # Arguments
/// * `enfants` - Référence à une tranche d'enfants avec leurs horaires
/// * `ratio` - Nombre d'enfants par assistant maternel
/// * `available_ams` - Liste des assistants maternels disponibles
/// # Returns
/// * `Vec<AssistantShift>` - Liste des shifts des assistants maternels
pub fn compute_assistant_shifts(enfants: &[Child], ratio: u8, available_ams: &[AssistantProfile]) -> Vec<AssistantShift> {
    let available_ids: Vec<u8> = available_ams.iter().map(|am| am.id).collect();
    let max_am = available_ids.len() as u8;

    // Construire les segments de temps
    let segments = build_segments(enfants, max_am, ratio);
    // Si pas de segments, retourner vide
    if segments.is_empty() {
        return Vec::new();
    }

    // Fin de journée (dernier segment)
    let day_end = segments.last().unwrap().end;

    // État interne pour le calcul
    #[derive(Debug)]
    struct AssistState {
        id: u8,
        start: Option<u16>,      // Début du shift courant
        active: bool,            // Est-ce que l'AM travaille actuellement ?
        total_minutes: u32,      // Total des minutes travaillées (pour l'équilibrage)
    }

    // Initialiser les états des assistants maternels
    let mut ams: Vec<AssistState> = available_ids
        .iter()
        .map(|&real_id| AssistState {
            id: real_id,
            start: None,
            active: false,
            total_minutes: 0,
        })
        .collect();

    // Résultat : on pourra pousser plusieurs AssistantShift par AM
    let mut result: Vec<AssistantShift> = Vec::new();

    // Petit utilitaire : ajouter un TimeRange au shift existant pour cet am_id ou créer un nouveau shift
    fn push_time_range(result: &mut Vec<AssistantShift>, am_id: u8, tr: TimeRange) {
        if let Some(shift) = result.iter_mut().find(|s| s.am_id == am_id) {
            shift.heures.push(tr);
        } else {
            result.push(AssistantShift { am_id, heures: vec![tr] });
        }
    }

    // Parcourir les segments pour ajuster les shifts des assistants maternels
    for seg in &segments {
        let needed = seg.am_needed.min(max_am);

        // Nombre d'AM actuellement actifs
        let active_count = ams.iter().filter(|a| a.active).count() as u8;

        // Ajuster le nombre d'AM actifs selon les besoins du segment
        if needed > active_count {
            // AJOUT : choisir les AM avec le moins d'heures travaillées
            let mut to_add = needed - active_count;

            // Trier les AM inactifs par total_minutes (croissant) pour équilibrer
            let mut inactive_indices: Vec<usize> = ams
                .iter()
                .enumerate()
                .filter(|(_, a)| !a.active)
                .map(|(i, _)| i)
                .collect();

            // Trier par heures travaillées (le moins d'heures en premier)
            inactive_indices.sort_by_key(|&i| ams[i].total_minutes);

            for idx in inactive_indices {
                if to_add == 0 { break; }
                ams[idx].start = Some(seg.start);
                ams[idx].active = true;
                to_add -= 1;
            }
        } else if needed < active_count {
            // RETRAIT : retirer les AM avec le plus d'heures travaillées
            // (pour équilibrer, on garde ceux qui ont moins travaillé)
            let mut active_indices: Vec<usize> = ams
                .iter()
                .enumerate()
                .filter(|(_, a)| a.active)
                .map(|(i, _)| i)
                .collect();

            // Trier par heures travaillées (le plus d'heures en premier = à retirer en priorité)
            // On ajoute aussi les heures du shift en cours pour un calcul plus précis
            active_indices.sort_by_key(|&i| {
                let current_shift_duration = ams[i].start.map(|s| (seg.start - s) as u32).unwrap_or(0);
                std::cmp::Reverse(ams[i].total_minutes + current_shift_duration)
            });

            let mut to_remove = active_count - needed;
            for idx in active_indices {
                if to_remove == 0 { break; }
                // Clore le shift et comptabiliser les heures
                if let Some(s) = ams[idx].start {
                    let duration = (seg.start - s) as u32;
                    ams[idx].total_minutes += duration;
                    push_time_range(&mut result, ams[idx].id, TimeRange { arrivee: s, depart: seg.start });
                }
                ams[idx].active = false;
                ams[idx].start = None;
                to_remove -= 1;
            }
        }
    }

    // Clôture fin de journée : pour chaque AM encore actif, clore son shift
    for am in &mut ams {
        if am.active {
            if let Some(s) = am.start {
                push_time_range(&mut result, am.id, TimeRange { arrivee: s, depart: day_end });
            }
            am.active = false;
            am.start = None;
        }
    }

    // Retourner tous les shifts collectés (plusieurs par AM possible)
    result
}

/// Calcule les shifts avec équilibrage sur plusieurs jours.
/// Cette fonction prend en compte les heures déjà travaillées sur le mois
/// pour mieux répartir les nouveaux shifts.
///
/// # Arguments
/// * `enfants` - Liste des enfants pour le jour courant
/// * `ratio` - Ratio enfants/AM
/// * `available_ams` - Liste des AM disponibles
/// * `accumulated_hours` - Map des heures déjà accumulées par AM (am_id -> minutes)
/// # Returns
/// * `Vec<AssistantShift>` - Les shifts calculés pour ce jour
pub fn compute_assistant_shifts_balanced(
    enfants: &[Child],
    ratio: u8,
    available_ams: &[AssistantProfile],
    accumulated_hours: &HashMap<u8, u32>
) -> Vec<AssistantShift> {
    let available_ids: Vec<u8> = available_ams.iter().map(|am| am.id).collect();
    let max_am = available_ids.len() as u8;

    let segments = build_segments(enfants, max_am, ratio);
    if segments.is_empty() {
        return Vec::new();
    }

    let day_end = segments.last().unwrap().end;

    #[derive(Debug)]
    struct AssistState {
        id: u8,
        start: Option<u16>,
        active: bool,
        total_minutes: u32,  // Inclut les heures accumulées du mois
    }

    // Initialiser avec les heures déjà accumulées
    let mut ams: Vec<AssistState> = available_ids
        .iter()
        .map(|&real_id| AssistState {
            id: real_id,
            start: None,
            active: false,
            total_minutes: *accumulated_hours.get(&real_id).unwrap_or(&0),
        })
        .collect();

    let mut result: Vec<AssistantShift> = Vec::new();

    fn push_time_range(result: &mut Vec<AssistantShift>, am_id: u8, tr: TimeRange) {
        if let Some(shift) = result.iter_mut().find(|s| s.am_id == am_id) {
            shift.heures.push(tr);
        } else {
            result.push(AssistantShift { am_id, heures: vec![tr] });
        }
    }

    for seg in &segments {
        let needed = seg.am_needed.min(max_am);
        let active_count = ams.iter().filter(|a| a.active).count() as u8;

        if needed > active_count {
            let mut to_add = needed - active_count;
            let mut inactive_indices: Vec<usize> = ams
                .iter()
                .enumerate()
                .filter(|(_, a)| !a.active)
                .map(|(i, _)| i)
                .collect();

            inactive_indices.sort_by_key(|&i| ams[i].total_minutes);

            for idx in inactive_indices {
                if to_add == 0 { break; }
                ams[idx].start = Some(seg.start);
                ams[idx].active = true;
                to_add -= 1;
            }
        } else if needed < active_count {
            let mut active_indices: Vec<usize> = ams
                .iter()
                .enumerate()
                .filter(|(_, a)| a.active)
                .map(|(i, _)| i)
                .collect();

            active_indices.sort_by_key(|&i| {
                let current_shift_duration = ams[i].start.map(|s| (seg.start - s) as u32).unwrap_or(0);
                std::cmp::Reverse(ams[i].total_minutes + current_shift_duration)
            });

            let mut to_remove = active_count - needed;
            for idx in active_indices {
                if to_remove == 0 { break; }
                if let Some(s) = ams[idx].start {
                    let duration = (seg.start - s) as u32;
                    ams[idx].total_minutes += duration;
                    push_time_range(&mut result, ams[idx].id, TimeRange { arrivee: s, depart: seg.start });
                }
                ams[idx].active = false;
                ams[idx].start = None;
                to_remove -= 1;
            }
        }
    }

    for am in &mut ams {
        if am.active {
            if let Some(s) = am.start {
                push_time_range(&mut result, am.id, TimeRange { arrivee: s, depart: day_end });
            }
            am.active = false;
            am.start = None;
        }
    }

    result
}

/// Construit les segments de temps avec le nombre d'AM nécessaires.
/// Permet de déterminer les périodes où des assistants maternels sont requis en fonction des horaires des enfants.
/// # Arguments
/// * `enfants` - Référence à une tranche d'enfants avec leurs horaires
/// * `max_am` - Nombre maximum d'assistants maternels disponibles
/// # Returns
/// * `Vec<Segment>` - Vecteur des segments de temps avec le nombre d'AM nécessaires
fn build_segments(enfants: &[Child], max_am: u8, ratio: u8) -> Vec<Segment> {
    // Construire la liste des événements (arrivées et départs)
    let mut events: Vec<(u16, i8)> = Vec::new();
    // Pour chaque enfant, ajouter ses heures d'arrivée et de départ
    for child in enfants {
        for tr in &child.heures {
            events.push((tr.arrivee, 1));
            events.push((tr.depart, -1));
        }
    }

    // Si pas d'événements, retourner vide
    if events.is_empty() { return Vec::new(); }

    // Tri: temps croissant, puis départs (-1) avant arrivées (1)
    events.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));

    // Construire les segments
    let mut segments = Vec::new();
    let mut enfants_actuels: u8 = 0;
    let mut prev_time: Option<u16> = None;

    // Parcourir les événements triés
    for (time, delta) in events {
        // Si on a un temps précédent, créer un segment
        if let Some(start) = prev_time {
            // Ajouter un segment si le temps a changé et qu'il y a des enfants présents
            if time > start && enfants_actuels > 0 {
                // Formule mathématique pour "Ceil(enfants / ratio)"
                let needed = enfants_actuels.div_ceil(ratio);
                segments.push(Segment {
                    start,
                    end: time,
                    am_needed: needed.min(max_am),
                });
            }
        }
        // Mettre à jour le nombre d'enfants actuels et le temps précédent
        enfants_actuels = enfants_actuels.saturating_add_signed(delta);
        prev_time = Some(time);
    }
    // Retourner les segments construits
    segments
}