use std::collections::HashMap;
use crate::models::{AssistantProfile, AssistantShift, Child, TimeRange};

/// Structure interne représentant un segment de temps avec le nombre d'AM nécessaires
struct Segment {
    start: u16,
    end: u16,
    am_needed: u8,
}

/// Calcule la durée totale de chaque position de slot sur la journée.
/// La fermeture suit une logique FIFO : le slot ouvert le plus tôt est fermé en premier.
/// En cas d'égalité d'heure d'ouverture, le slot d'indice le plus bas est fermé en premier
/// (ce slot est attribué à l'AM avec le plus d'heures accumulées, qui part donc en priorité).
/// Le slot d'indice le plus haut est le plus stable (ouvert en dernier, fermé en dernier).
fn compute_slot_durations(segments: &[Segment]) -> Vec<u32> {
    let max_slots = segments.iter().map(|s| s.am_needed as usize).max().unwrap_or(0);
    let mut durations = vec![0u32; max_slots];
    let mut slot_starts: Vec<Option<u16>> = vec![None; max_slots];

    for seg in segments {
        let needed = seg.am_needed as usize;
        let active_count = slot_starts.iter().filter(|s| s.is_some()).count();

        if needed > active_count {
            // Ouvrir les slots inactifs les plus bas en premier
            let mut to_open = needed - active_count;
            for slot in slot_starts.iter_mut() {
                if to_open == 0 { break; }
                if slot.is_none() {
                    *slot = Some(seg.start);
                    to_open -= 1;
                }
            }
        } else if needed < active_count {
            // FIFO : fermer les slots avec l'heure de début la plus ancienne
            // À égalité, fermer l'indice le plus bas en premier
            let to_close = active_count - needed;
            let mut active_slots: Vec<(u16, usize)> = slot_starts.iter()
                .enumerate()
                .filter_map(|(i, s)| s.map(|start| (start, i)))
                .collect();
            active_slots.sort(); // tri par start asc, puis index asc (ordre naturel du tuple)

            for &(start, idx) in active_slots.iter().take(to_close) {
                durations[idx] += (seg.start - start) as u32;
                slot_starts[idx] = None;
            }
        }
    }

    if let Some(last) = segments.last() {
        for (i, s) in slot_starts.iter().enumerate() {
            if let Some(start) = s {
                durations[i] += (last.end - start) as u32;
            }
        }
    }

    durations
}

/// Construit la table d'affectation slot → am_id.
/// Les slots les plus longs sont attribués aux AM avec le moins d'heures accumulées.
/// En cas d'égalité d'heures, l'ordre dans `available_ams` est respecté (tri stable).
fn build_slot_assignment(
    slot_durations: &[u32],
    available_ams: &[AssistantProfile],
    accumulated_hours: &HashMap<u8, u32>,
) -> Vec<u8> {
    let num_slots = slot_durations.len();

    // Indices des slots triés par durée décroissante (slot le plus long en premier)
    let mut slot_indices: Vec<usize> = (0..num_slots).collect();
    slot_indices.sort_by(|&a, &b| slot_durations[b].cmp(&slot_durations[a]));

    // Indices de TOUTES les AM triés par heures accumulées croissantes (moins d'heures en premier)
    // On trie sur toutes les AM disponibles avant de limiter au nombre de slots
    let mut am_indices: Vec<usize> = (0..available_ams.len()).collect();
    am_indices.sort_by_key(|&i| *accumulated_hours.get(&available_ams[i].id).unwrap_or(&0));

    let mut am_for_slot = vec![0u8; num_slots];
    for (rank, &slot_idx) in slot_indices.iter().enumerate() {
        if rank < am_indices.len() {
            am_for_slot[slot_idx] = available_ams[am_indices[rank]].id;
        }
    }

    am_for_slot
}

/// Calcule les shifts des assistants maternels pour une liste d'enfants donnée.
/// Wrapper de `compute_assistant_shifts_balanced` sans heures accumulées.
///
/// # Arguments
/// * `enfants` - Référence à une tranche d'enfants avec leurs horaires
/// * `ratio` - Nombre d'enfants par assistant maternel
/// * `available_ams` - Liste des assistants maternels disponibles
/// # Returns
/// * `Vec<AssistantShift>` - Liste des shifts des assistants maternels
pub fn compute_assistant_shifts(enfants: &[Child], ratio: u8, available_ams: &[AssistantProfile]) -> Vec<AssistantShift> {
    compute_assistant_shifts_balanced(enfants, ratio, available_ams, &HashMap::new())
}

/// Calcule les shifts avec équilibrage sur plusieurs jours.
///
/// L'algorithme fonctionne en 2 passes :
/// 1. Calcul des durées de chaque position de slot sur la journée
/// 2. Pré-affectation : les slots les plus longs vont aux AM avec le moins d'heures accumulées
///
/// La rotation FIFO est garantie structurellement : les positions hautes (rotatifs) ferment
/// en premier (LIFO) et rouvrent en premier, donc l'AM qui débauche en premier réembauche
/// en premier.
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
    accumulated_hours: &HashMap<u8, u32>,
) -> Vec<AssistantShift> {
    let max_am = available_ams.len() as u8;

    let segments = build_segments(enfants, max_am, ratio);
    if segments.is_empty() {
        return Vec::new();
    }

    let day_end = segments.last().unwrap().end;

    // Passe 1 : durées par position de slot + affectation slot → AM
    let slot_durations = compute_slot_durations(&segments);
    let am_for_slot = build_slot_assignment(&slot_durations, available_ams, accumulated_hours);

    #[derive(Debug)]
    struct AssistState {
        id: u8,
        start: Option<u16>,
        active: bool,
        slot_index: usize,  // Position dans am_for_slot
    }

    let mut ams: Vec<AssistState> = available_ams
        .iter()
        .map(|am| AssistState {
            id: am.id,
            start: None,
            active: false,
            slot_index: 0,
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

    // Passe 2 : exécution segment par segment avec affectation fixe
    for seg in &segments {
        let needed = seg.am_needed.min(max_am) as usize;
        let active_count = ams.iter().filter(|a| a.active).count();

        if needed > active_count {
            // AJOUT : ouvrir les slots inactifs les plus bas en premier
            let mut to_open = needed - active_count;
            for slot_idx in 0..am_for_slot.len() {
                if to_open == 0 { break; }
                if ams.iter().any(|a| a.active && a.slot_index == slot_idx) {
                    continue; // slot déjà occupé
                }
                let target_id = am_for_slot[slot_idx];
                if let Some(am) = ams.iter_mut().find(|a| !a.active && a.id == target_id) {
                    am.start = Some(seg.start);
                    am.active = true;
                    am.slot_index = slot_idx;
                    to_open -= 1;
                }
            }
        } else if needed < active_count {
            // RETRAIT FIFO : fermer les AMs actifs les plus anciens en premier
            // À égalité d'heure d'embauche, fermer le slot_index le plus bas
            // (le slot bas correspond à l'AM avec le plus d'heures accumulées)
            let to_close = active_count - needed;
            let mut active_ams: Vec<(u16, usize)> = ams.iter()
                .filter(|a| a.active)
                .map(|a| (a.start.unwrap_or(0), a.slot_index))
                .collect();
            active_ams.sort(); // tri par start asc, puis slot_index asc

            let slots_to_close: Vec<usize> = active_ams.iter()
                .take(to_close)
                .map(|&(_, slot_idx)| slot_idx)
                .collect();

            for slot_idx in slots_to_close {
                if let Some(am) = ams.iter_mut().find(|a| a.active && a.slot_index == slot_idx) {
                    if let Some(s) = am.start {
                        push_time_range(&mut result, am.id, TimeRange { arrivee: s, depart: seg.start });
                    }
                    am.active = false;
                    am.start = None;
                }
            }
        }
    }

    // Clôture fin de journée
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

        // L'algorithme devrait préférer AM2 car il a moins d'heures (slot unique → AM avec moins d'heures)
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].am_id, 1);
    }

    #[test]
    fn test_longer_slot_assigned_to_am_with_fewer_hours() {
        // Scénario : slot0 = 8h→17h (540 min), slot1 = 14h→16h (120 min)
        // AM1 a 600 min accumulées, AM2 a 100 min → AM2 (moins d'heures) doit avoir le slot long
        let enfants = vec![
            create_child("Alice", 480, 1020), // 8h - 17h
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
            create_child("Eve", 840, 960),    // 14h - 16h (5e enfant → 2e AM nécessaire sur ce créneau)
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        // AM1 a beaucoup d'heures, AM2 très peu → AM2 devrait avoir le slot le plus long
        let mut accumulated: HashMap<u8, u32> = HashMap::new();
        accumulated.insert(0, 600); // AM1 : 10h accumulées
        accumulated.insert(1, 100); // AM2 : 1h40 accumulées

        let result = compute_assistant_shifts_balanced(&enfants, 4, &ams, &accumulated);

        // Trouver l'AM qui a le shift le plus long
        let duration_per_am: Vec<(u8, u32)> = result.iter().map(|s| {
            let dur: u32 = s.heures.iter().map(|r| (r.depart - r.arrivee) as u32).sum();
            (s.am_id, dur)
        }).collect();

        let longest = duration_per_am.iter().max_by_key(|&&(_, d)| d).unwrap();
        // AM2 (id=1, moins d'heures) doit avoir le slot le plus long
        assert_eq!(longest.0, 1, "AM avec moins d'heures accumulées devrait avoir le slot le plus long");
    }

    #[test]
    fn test_fifo_rotation_debauche_reembauche() {
        // Scénario FIFO : l'AM qui embauche en premier débauche en premier
        // Matin 8h-12h : 2 AM (slot0=AM2 rotative, slot1=AM1 stable)
        // Midi 12h-14h : 1 AM (AM2 débauche en premier = FIFO ferme slot0, le plus ancien à égalité)
        // AprèsMidi 14h-17h : 2 AM (AM2 réembauche en premier via slot0)
        let enfants = vec![
            create_child("Alice", 480, 1020),   // 8h - 17h
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
            create_child("Eve", 480, 720),      // 8h - 12h (5e enfant le matin → 2 AM)
            create_child("Frank", 840, 1020),   // 14h - 17h (5e enfant l'AM → 2 AM)
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // AM2 (slot1) doit avoir 2 plages : 8h-12h et 14h-17h (débauche et réembauche)
        let am2_shift = result.iter().find(|s| s.am_id == 1);
        assert!(am2_shift.is_some(), "AM2 devrait avoir des shifts");
        let am2 = am2_shift.unwrap();
        assert_eq!(am2.heures.len(), 2, "AM2 devrait avoir 2 plages (matin + après-midi)");
        assert_eq!(am2.heures[0].arrivee, 480);
        assert_eq!(am2.heures[0].depart, 720);
        assert_eq!(am2.heures[1].arrivee, 840);
        assert_eq!(am2.heures[1].depart, 1020);
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
    fn test_fifo_premier_embauche_premier_debauche() {
        // Scénario FIFO strict : une AM embauche seule à 8h, une autre la rejoint à 10h (5e enfant)
        // À 14h on repasse à 4 enfants → l'AM embauchée la première (8h) doit débaucher en premier
        let enfants = vec![
            create_child("Alice", 480, 1020), // 8h - 17h
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
            create_child("Eve", 600, 840),    // 10h - 14h (5e enfant → 2e AM)
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];
        let result = compute_assistant_shifts(&enfants, 4, &ams);

        // On vérifie la propriété temporelle : l'AM qui commence à 8h débauche à 14h (FIFO)
        let am_8h = result.iter()
            .find(|s| s.heures.iter().any(|h| h.arrivee == 480))
            .expect("Une AM doit commencer à 8h");
        assert_eq!(am_8h.heures.len(), 1, "L'AM démarrant à 8h n'a qu'une plage (8h-14h)");
        assert_eq!(am_8h.heures[0].depart, 840, "L'AM embauchée à 8h débauche à 14h (premier embauché = premier débauché)");

        // L'AM qui commence à 10h reste jusqu'à 17h
        let am_10h = result.iter()
            .find(|s| s.heures.iter().any(|h| h.arrivee == 600))
            .expect("Une AM doit commencer à 10h");
        assert_eq!(am_10h.heures.len(), 1, "L'AM démarrant à 10h n'a qu'une plage (10h-17h)");
        assert_eq!(am_10h.heures[0].depart, 1020, "L'AM embauchée à 10h débauche à 17h");

        // Les deux AM sont bien distinctes
        assert_ne!(am_8h.am_id, am_10h.am_id);
    }

    #[test]
    fn test_fifo_tiebreak_par_heures_accumulees() {
        // Tie-break : deux AM embauchent à 8h simultanément.
        // AM1 a plus d'heures accumulées → AM1 doit débaucher en premier.
        let enfants = vec![
            create_child("Alice", 480, 1020), // 8h - 17h
            create_child("Bob", 480, 1020),
            create_child("Charlie", 480, 1020),
            create_child("David", 480, 1020),
            create_child("Eve", 480, 720),    // 8h - 12h (5e enfant le matin → 2 AM simultanées)
        ];
        let ams = vec![create_am(0, "AM1"), create_am(1, "AM2")];

        let mut accumulated: HashMap<u8, u32> = HashMap::new();
        accumulated.insert(0, 600); // AM1 : 10h accumulées
        accumulated.insert(1, 100); // AM2 : 1h40 accumulées

        let result = compute_assistant_shifts_balanced(&enfants, 4, &ams, &accumulated);

        // À 12h on repasse à 1 AM : AM1 (plus d'heures accumulées) doit débaucher en premier
        let am1 = result.iter().find(|s| s.am_id == 0).expect("AM1 doit avoir des shifts");
        let am2 = result.iter().find(|s| s.am_id == 1).expect("AM2 doit avoir des shifts");

        assert_eq!(am1.heures[0].depart, 720, "AM1 (plus d'heures accumulées) débauche à 12h");
        assert_eq!(am2.heures[0].depart, 1020, "AM2 (moins d'heures accumulées) reste jusqu'à 17h");
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