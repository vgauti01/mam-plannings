use crate::models::{AssistantShift, Child};

/// Structure interne représentant un segment de temps avec le nombre d'AM nécessaires
struct Segment {
    start: u16,
    end: u16,
    am_needed: usize,
}

/// Calcule les shifts des assistants maternels pour une liste d'enfants donnée
/// # Arguments
/// * `enfants` - Référence à une tranche d'enfants avec leurs horaires
/// * `max_am` - Nombre maximum d'assistants maternels disponibles
/// # Returns
/// * `Result<Vec<AssistantShift>, Box<dyn Error>>` - Liste des shifts des assistants maternels ou une erreur en cas d'échec
pub fn compute_assistant_shifts(enfants: &[Child], max_am: usize) -> Vec<AssistantShift> {
    // Construire les segments de temps
    let segments = build_segments(enfants, max_am);
    // Si pas de segments, retourner vide
    if segments.is_empty() {
        return Vec::new();
    }

    // Fin de journée (dernier segment)
    let day_end = segments.last().unwrap().end;

    // État interne pour le calcul
    // Représente l'état d'un assistant maternel
    // avec son ID, ses heures de début et de fin, et son statut actif
    #[derive(Debug)]
    struct AssistState {
        id: usize,
        start: Option<u16>,
        end: Option<u16>,
        active: bool,
        ever_used: bool,
    }

    // Initialiser les états des assistants maternels
    let mut ams: Vec<AssistState> = (0..max_am)
        .map(|i| AssistState {
            id: i,
            start: None,
            end: None,
            active: false,
            ever_used: false,
        })
        .collect();

    // Parcourir les segments pour ajuster les shifts des assistants maternels
    for seg in &segments {
        let needed = seg.am_needed.min(max_am);
        let active_indices: Vec<usize> = ams
            .iter()
            .enumerate()
            .filter(|(_, a)| a.active)
            .map(|(i, _)| i)
            .collect();

        // Nombre d'AM actuellement actifs
        let active_count = active_indices.len();

        // Ajuster le nombre d'AM actifs selon les besoins du segment
        if needed > active_count {
            // AJOUT
            let mut to_add = needed - active_count;
            for am in ams.iter_mut() {
                if to_add == 0 { break; }
                if !am.active {
                    if am.start.is_none() { am.start = Some(seg.start); }
                    am.active = true;
                    am.ever_used = true;
                    to_add -= 1;
                }
            }
        } else if needed < active_count {
            // RETRAIT (FIFO sur le start time)
            let mut actives: Vec<(usize, u16)> = ams
                .iter()
                .enumerate()
                .filter_map(|(i, a)| if a.active { Some((i, a.start.unwrap_or(seg.start))) } else { None })
                .collect();

            actives.sort_by_key(|&(_, s)| s);

            let mut to_remove = active_count - needed;
            for (idx, _) in actives {
                if to_remove == 0 { break; }
                ams[idx].active = false;
                ams[idx].end = Some(seg.start);
                to_remove -= 1;
            }
        }
    }

    // Clôture fin de journée
    for am in &mut ams {
        if am.active {
            am.end = Some(day_end);
            am.active = false;
        }
    }

    // Construire les shifts finaux des assistants maternels
    ams.into_iter()
        .filter_map(|a| {
            if a.ever_used {
                Some(AssistantShift {
                    am_id: a.id,
                    arrivee: a.start.unwrap(),
                    depart: a.end.unwrap(),
                })
            } else {
                None
            }
        })
        .collect()
}

/// Construit les segments de temps avec le nombre d'AM nécessaires.
/// Permet de déterminer les périodes où des assistants maternels sont requis en fonction des horaires des enfants.
/// # Arguments
/// * `enfants` - Référence à une tranche d'enfants avec leurs horaires
/// * `max_am` - Nombre maximum d'assistants maternels disponibles
/// # Returns
/// * `Vec<Segment>` - Vecteur des segments de temps avec le nombre d'AM nécessaires
fn build_segments(enfants: &[Child], max_am: usize) -> Vec<Segment> {
    // Construire la liste des événements (arrivées et départs)
    let mut events: Vec<(u16, i32)> = Vec::new();
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
    let mut enfants_actuels: i32 = 0;
    let mut prev_time: Option<u16> = None;

    // Parcourir les événements triés
    for (time, delta) in events {
        // Si on a un temps précédent, créer un segment
        if let Some(start) = prev_time {
            // Ajouter un segment si le temps a changé et qu'il y a des enfants présents
            if time > start && enfants_actuels > 0 {
                // Calculer le nombre d'AM nécessaires (1 AM pour 4 enfants)
                let needed = ((enfants_actuels + 3) / 4) as usize;
                segments.push(Segment {
                    start,
                    end: time,
                    am_needed: needed.min(max_am),
                });
            }
        }
        // Mettre à jour le nombre d'enfants actuels et le temps précédent
        enfants_actuels += delta;
        prev_time = Some(time);
    }
    // Retourner les segments construits
    segments
}