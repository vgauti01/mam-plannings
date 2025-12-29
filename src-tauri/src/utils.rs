use chrono::{NaiveDate, Datelike, Weekday};

/// Convertit une chaîne de caractères au format "HHhMM" en minutes depuis minuit.
/// Par exemple, "02h30" devient 150.
/// Si le format est invalide, retourne 0.
pub fn to_minutes_from_midnight(time_str: &str) -> u16 {
    let parts: Vec<&str> = time_str.split('h').collect();
    if parts.len() != 2 {
        return 0;
    }
    let hours: u16 = parts[0].parse().unwrap_or(0);
    let minutes: u16 = parts[1].parse().unwrap_or(0);
    hours * 60 + minutes
}

/// Convertit une date au format "YYYY-MM-DD" en nom du jour de la semaine en français.
/// Par exemple, "2025-01-06" (un lundi) devient "Lundi".
/// Si le format est invalide, retourne "Inconnu".
pub fn date_to_weekday_french(date_str: &str) -> String {
    match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(date) => match date.weekday() {
            Weekday::Mon => "Lundi".to_string(),
            Weekday::Tue => "Mardi".to_string(),
            Weekday::Wed => "Mercredi".to_string(),
            Weekday::Thu => "Jeudi".to_string(),
            Weekday::Fri => "Vendredi".to_string(),
            Weekday::Sat => "Samedi".to_string(),
            Weekday::Sun => "Dimanche".to_string(),
        },
        Err(_) => "Inconnu".to_string(),
    }
}
