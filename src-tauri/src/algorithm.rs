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

#[cfg(test)]
mod tests {
    use super::*;

    fn create_child(nom: &str, arrivee: u16, depart: u16) -> Child {
        Child {
            nom: nom.to_string(),
            heures: vec![TimeRange { arrivee, depart }],
        }
    }

    fn create_am(id: u8, name: &str) -> AssistantProfile {
        AssistantProfile {
            id,
            name: name.to_string(),
            color: "#000000".to_string(),
        }
    }

    #[test]
    fn test_no_children_returns_empty() {
        let enfants: Vec<Child> = vec![];
        let ams = vec![create_am(0, "AM1")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);
        assert!(result.is_empty());
    }

    #[test]
    fn test_single_child_single_am() {
        let enfants = vec![create_child("Alice", 480, 1020)]; // 8h - 17h
        let ams = vec![create_am(0, "AM1")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].am_id, 0);
        assert_eq!(result[0].heures.len(), 1);
        assert_eq!(result[0].heures[0].arrivee, 480);
        assert_eq!(result[0].heures[0].depart, 1020);
    }

    #[test]
    fn test_four_children_need_one_am_with_ratio_4() {
        let enfants = vec![
            create_child("Alice", 480, 1020),
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // Avec 4 enfants et ratio 4, on a besoin de 1 AM seulement
        let total_am_with_hours: usize = result.iter()
            .filter(|s| !s.heures.is_empty())
            .count();
        assert_eq!(total_am_with_hours, 1);
    }

    #[test]
    fn test_five_children_need_two_am_with_ratio_4() {
        let enfants = vec![
            create_child("Alice", 480, 1020),
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
            create_child("Eve", 480, 1020),
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // Avec 5 enfants et ratio 4, on a besoin de ceil(5/4) = 2 AM
        let total_am_with_hours: usize = result.iter()
            .filter(|s| !s.heures.is_empty())
            .count();
        assert_eq!(total_am_with_hours, 2);
    }

    #[test]
    fn test_children_arriving_at_different_times() {
        // 2 enfants le matin, 2 autres l'après-midi
        let enfants = vec![
            create_child("Alice", 480, 720),   // 8h - 12h
            create_child("Bob", 480, 720),     // 8h - 12h
            create_child("Charlie", 840, 1020), // 14h - 17h
            create_child("David", 840, 1020),   // 14h - 17h
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // On devrait avoir seulement 1 AM car jamais plus de 2 enfants simultanés
        let total_am_with_hours: usize = result.iter()
            .filter(|s| !s.heures.is_empty())
            .count();
        assert_eq!(total_am_with_hours, 1);
    }

    #[test]
    fn test_am_shifts_cover_all_children_presence() {
        let enfants = vec![
            create_child("Alice", 480, 1020),
            create_child("Bob", 540, 960),
        ];
        let ams = vec![create_am(0, "AM1")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        assert_eq!(result.len(), 1);
        // Le shift doit couvrir de 8h (premier arrivé) à 17h (dernier parti)
        let shift = &result[0];
        assert_eq!(shift.heures[0].arrivee, 480);
        assert_eq!(shift.heures[0].depart, 1020);
    }

    #[test]
    fn test_balanced_compute_with_accumulated_hours() {
        let enfants = vec![
            create_child("Alice", 480, 1020),
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        // AM1 a déjà travaillé 600 minutes, AM2 seulement 100
        let mut accumulated: HashMap<u8, u32> = HashMap::new();
        accumulated.insert(0, 600);
        accumulated.insert(1, 100);

        let result = compute_assistant_shifts_balanced(&enfants, 4, &ams, &accumulated);

        // L'algorithme devrait préférer AM2 car il a moins d'heures
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].am_id, 1);
    }

    #[test]
    fn test_multiple_time_ranges_per_child() {
        let enfants = vec![Child {
            nom: "Alice".to_string(),
            heures: vec![
                TimeRange { arrivee: 480, depart: 720 },  // 8h - 12h
                TimeRange { arrivee: 840, depart: 1020 }, // 14h - 17h
            ],
        }];
        let ams = vec![create_am(0, "AM1")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        assert!(!result.is_empty());
        // L'AM doit avoir au moins 2 plages (ou une plage continue selon l'algo)
        let total_minutes: u32 = result[0].heures.iter()
            .map(|r| (r.depart - r.arrivee) as u32)
            .sum();
        // 4h le matin + 3h l'après-midi = 7h = 420 min
        assert!(total_minutes >= 420);
    }

    #[test]
    fn test_ratio_3_needs_more_ams() {
        let enfants = vec![
            create_child("Alice", 480, 1020),
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        // Avec ratio 3, 4 enfants nécessitent ceil(4/3) = 2 AM
        let result = compute_assistant_shifts(&enfants, 3, &ams);
        let total_am_with_hours: usize = result.iter()
            .filter(|s| !s.heures.is_empty())
            .count();
        assert_eq!(total_am_with_hours, 2);
    }

    #[test]
    fn test_max_am_limit() {
        // Beaucoup d'enfants mais seulement 2 AM disponibles
        let enfants: Vec<Child> = (0..20)
            .map(|i| create_child(&format!("Enfant{}", i), 480, 1020))
            .collect();
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // On ne peut pas avoir plus de 2 AM (le max disponible)
        let total_am_with_hours: usize = result.iter()
            .filter(|s| !s.heures.is_empty())
            .count();
        assert!(total_am_with_hours <= 2);
    }

    #[test]
    fn test_progressive_arrival_departure() {
        // Les enfants arrivent progressivement puis partent progressivement
        let enfants = vec![
            create_child("Alice", 480, 900),   // 8h - 15h
            create_child("Bob", 540, 960),     // 9h - 16h
            create_child("Charlie", 600, 1020), // 10h - 17h
            create_child("David", 660, 1080),   // 11h - 18h
            create_child("Eve", 720, 1140),     // 12h - 19h
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // Il devrait y avoir des shifts car il y a des enfants
        assert!(!result.is_empty());

        // Vérifier que les shifts couvrent toute la période de présence des enfants
        let earliest_start = result.iter()
            .flat_map(|s| s.heures.iter())
            .map(|r| r.arrivee)
            .min()
            .unwrap_or(0);
        let latest_end = result.iter()
            .flat_map(|s| s.heures.iter())
            .map(|r| r.depart)
            .max()
            .unwrap_or(0);

        assert_eq!(earliest_start, 480); // Premier enfant arrive à 8h
        assert_eq!(latest_end, 1140);    // Dernier enfant part à 19h
    }
}