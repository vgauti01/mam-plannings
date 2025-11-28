use std::collections::HashMap;
use std::error::Error;
use regex::Regex;
use crate::models::{AssistantProfile, Child, Day, MonthSettings, TimeRange};
use crate::utils::to_minutes_from_midnight;
use crate::algorithm::compute_assistant_shifts;
use crate::commands::get_month_key;

/// Parse un fichier PDF de planning et retourne une liste de jours avec les enfants et leurs horaires.
/// # Arguments
/// * `path` - Chemin vers le fichier PDF.
/// * `year` - Année à utiliser pour les dates.
/// # Returns
/// * `Result<Vec<Day>, Box<dyn Error>>` - Liste des jours ou une erreur en cas d'échec.
pub fn parse_planning(path: &str, year: i32, month_configs: &HashMap<String, MonthSettings>) -> Result<Vec<Day>, Box<dyn Error>> {
    // Lire le fichier PDF
    let bytes = std::fs::read(path)?;
    // Extraire le texte du PDF
    let parsed_text = pdf_extract::extract_text_from_mem(&bytes)?;

    // Regex pour détecter les lignes de jour (ex: "LUN. 7/01")
    let day_re = Regex::new(r"(LUN\.|MAR\.|MER\.|JEU\.|VEN\.)\s*(\d{1,2})/(\d{2})")?;

    // Vecteur pour stocker les jours extraits
    let mut days: Vec<Day> = Vec::new();
    // Vecteur pour stocker les lignes courantes d'un jour
    let mut current_lines: Vec<String> = Vec::new();

    // Variables d'état temporaires
    let mut current_day_num: Option<u32> = None;
    let mut current_month: Option<u32> = None;
    let mut current_day_abbr: Option<String> = None;

    // Parcourir chaque ligne du texte extrait
    for raw_line in parsed_text.lines() {
        let line = raw_line.trim_end();

        // Vérifier si la ligne correspond à un jour (ex: "LUN. 7/01")
        if let Some(caps) = day_re.captures(line) {
            // Finir le jour précédent
            if let (Some(d_num), Some(month), Some(ref abbr)) = (current_day_num, current_month, &current_day_abbr) {
                let date = format!("{}-{:02}-{:02}", year, month, d_num);
                let jour = map_day_name(abbr);

                let key = get_month_key(&date);
                // On cherche le ratio spécifique, sinon 4 par défaut
                let ratio = month_configs.get(&key).map(|c| c.ratio).unwrap_or(4);
                let active_team = month_configs
                    .get(&key)
                    .map(|c| c.active_team.clone())
                    .unwrap_or_default();

                if let Some(day) = process_day(&date, &jour, &current_lines, ratio, &active_team)? {
                    days.push(day);
                }
            }
            // Nouveau jour
            current_day_abbr = Some(caps[1].to_string());
            current_day_num = Some(caps[2].parse()?);
            current_month = Some(caps[3].parse()?);
            current_lines.clear();
        } else { // Sinon, c'est une ligne d'enfant ou autre
            if current_day_num.is_some() {
                current_lines.push(line.to_string());
            }
        }
    }

    // Dernier jour
    if let (Some(d_num), Some(month), Some(ref abbr)) = (current_day_num, current_month, &current_day_abbr) {
        let date = format!("{}-{:02}-{:02}", year, month, d_num);
        let jour = map_day_name(abbr);

        let key = get_month_key(&date);
        // On cherche le ratio spécifique, sinon 4 par défaut
        let ratio = month_configs.get(&key).map(|c| c.ratio).unwrap_or(4);
        let active_team = month_configs
            .get(&key)
            .map(|c| c.active_team.clone())
            .unwrap_or_default();

        if let Some(day) = process_day(&date, &jour, &current_lines, ratio, &active_team)? {
            days.push(day);
        }
    }
    
    Ok(days)
}

/// Mappe les abréviations des jours en français complet.
/// Ex: "LUN." -> "Lundi"
/// # Arguments
/// * `abbr` - Abréviation du jour.
/// # Returns
/// * `String` - Nom complet du jour.
fn map_day_name(abbr: &str) -> String {
    match abbr {
        "LUN." => "Lundi".to_string(),
        "MAR." => "Mardi".to_string(),
        "MER." => "Mercredi".to_string(),
        "JEU." => "Jeudi".to_string(),
        "VEN." => "Vendredi".to_string(),
        _ => abbr.trim_end_matches('.').to_string(),
    }
}

/// Traite les lignes d'un jour pour extraire les enfants et leurs horaires.
/// # Arguments
/// * `date` - Date du jour.
/// * `jour` - Nom du jour.
/// * `lines` - Lignes associées au jour.
/// # Returns
/// * `Result<Option<Day>, Box<dyn Error>>` - Jour traité ou None s'il n'y a pas d'enfants ou une erreur en cas d'échec.
fn process_day(date: &str, jour: &str, lines: &[String], ratio: u8, active_team: &Vec<AssistantProfile>) -> Result<Option<Day>, Box<dyn Error>> {
    // Lignes du style "7h30 - 18h30 (11h)" -> à ignorer
    let global_hours_re =
        Regex::new(r"^\s*\d{1,2}h\d{2}\s*-\s*\d{1,2}h\d{2}.*$")?;

    // Début d’une ligne enfant, ex: "Anna H. M.F. 8h00 - 8h30/16h30 - 18h00"
    let child_start_re = Regex::new(
        r"^[A-ZÉÈÀÂÇ][a-zA-Zéèêàâçïü\-]+(?:\s+[A-Z][a-zA-Zéèêàâçïü\-]+)?\s+[A-Z]\.",
    )?;

    // "8h00 - 8h30" ou "16h30 - 18h00" etc.
    let time_range_re =
        Regex::new(r"(\d{1,2})h(\d{2})\s*-\s*(\d{1,2})h(\d{2})")?;

    // Fusionner les lignes enfants qui sont sur plusieurs lignes
    let mut merged_child_lines: Vec<String> = Vec::new();
    // Ligne enfant en cours de construction
    let mut current_line: Option<String> = None;

    // Parcourir les lignes pour fusionner
    for line in lines {
        let l = line.trim();
        // Si la ligne est vide ou une ligne d'horaires globales (ex: "7h30 - 18h30"), on l'ignore
        if l.is_empty() || global_hours_re.is_match(l) { continue; }

        // Si la ligne commence une nouvelle entrée enfant (ex: "Anna H. ...")
        if child_start_re.is_match(l) {
            // Sauvegarder la ligne en cours si elle existe
            if let Some(existing) = current_line.take() { merged_child_lines.push(existing); }
            // Démarrer une nouvelle ligne enfant
            current_line = Some(l.to_string());
        } else if let Some(ref mut existing) = current_line {
            // Continuer la ligne enfant en cours
            existing.push(' ');
            existing.push_str(l);
        }
    }
    // Sauvegarder la dernière ligne en cours si elle existe
    if let Some(existing) = current_line.take() { merged_child_lines.push(existing); }

    // Analyser les lignes enfants fusionnées pour extraire les noms et horaires
    let mut children_map: HashMap<String, Vec<TimeRange>> = HashMap::new();
    for raw in merged_child_lines {
        if let Some((nom, ranges)) = parse_child_line(&raw, &time_range_re) {
            let entry = children_map.entry(nom).or_insert_with(Vec::new);
            entry.extend(ranges);
        }
    }

    // Si aucun enfant n'a été trouvé, retourner None
    if children_map.is_empty() { return Ok(None); }

    // Convertir la map en vecteur trié d'enfants
    let mut enfants: Vec<Child> = children_map
        .into_iter()
        .map(|(nom, heures)| Child { nom, heures })
        .collect();
    enfants.sort_by(|a, b| a.nom.cmp(&b.nom));

    // Calcul des AM ici via l'algo
    let am_shifts = compute_assistant_shifts(&enfants, ratio, active_team);

    // Retourner le jour construit
    Ok(Some(Day {
        date: date.to_string(),
        jour: jour.to_string(),
        enfants,
        am: am_shifts,
    }))
}

/// Analyse une ligne enfant pour extraire le nom et les plages horaires.
/// # Arguments
/// * `raw` - Ligne brute de l'enfant.
/// * `time_range_re` - Regex pour détecter les plages horaires.
/// # Returns
/// * `Option<(String, Vec<TimeRange>)>` - Nom de l'enfant et ses plages horaires ou None en cas d'échec.
fn parse_child_line(raw: &str, time_range_re: &Regex) -> Option<(String, Vec<TimeRange>)> {
    // Nettoyer la ligne en enlevant les astérisques
    let clean = raw.replace('*', "");
    // Séparer la ligne en parties (nom et horaires)
    let parts: Vec<&str> = clean.split_whitespace().collect();
    // Il doit y avoir au moins un nom et des horaires
    if parts.len() < 2 { return None; }

    // Extraire le nom (peut inclure un initiale avec point)
    let nom = if parts.len() >= 2 && parts[1].ends_with('.') {
        format!("{} {}", parts[0], parts[1])
    } else {
        parts[0].to_string()
    };

    // Trouver l'index où commencent les horaires (première occurrence de "h")
    let time_start_idx = parts.iter().position(|p| p.contains('h'))?;
    // Joindre les parties horaires en une seule chaîne
    let times_str = parts[time_start_idx..].join(" ");

    // Extraire les plages horaires
    let mut ranges: Vec<TimeRange> = Vec::new();

    // Itérer sur toutes les correspondances de plages horaires (ex: "8h00 - 8h30")
    for caps in time_range_re.captures_iter(&times_str) {
        let h1: u32 = caps[1].parse().ok()?;
        let m1: u32 = caps[2].parse().ok()?;
        let h2: u32 = caps[3].parse().ok()?;
        let m2: u32 = caps[4].parse().ok()?;

        let arrivee = format!("{:02}h{:02}", h1, m1);
        let depart = format!("{:02}h{:02}", h2, m2);

        ranges.push(TimeRange {
            arrivee: to_minutes_from_midnight(&arrivee),
            depart: to_minutes_from_midnight(&depart),
        });
    }

    // Retourner le nom et les plages horaires si au moins une plage a été trouvée
    if ranges.is_empty() { None } else { Some((nom, ranges)) }
}