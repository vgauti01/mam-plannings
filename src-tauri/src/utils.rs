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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_minutes_basic() {
        assert_eq!(to_minutes_from_midnight("00h00"), 0);
        assert_eq!(to_minutes_from_midnight("01h00"), 60);
        assert_eq!(to_minutes_from_midnight("02h30"), 150);
    }

    #[test]
    fn test_to_minutes_common_times() {
        assert_eq!(to_minutes_from_midnight("08h00"), 480);
        assert_eq!(to_minutes_from_midnight("12h00"), 720);
        assert_eq!(to_minutes_from_midnight("17h00"), 1020);
        assert_eq!(to_minutes_from_midnight("23h59"), 1439);
    }

    #[test]
    fn test_to_minutes_with_padding() {
        assert_eq!(to_minutes_from_midnight("08h05"), 485);
        assert_eq!(to_minutes_from_midnight("9h30"), 570);
    }

    #[test]
    fn test_to_minutes_invalid_format() {
        assert_eq!(to_minutes_from_midnight("invalid"), 0);
        assert_eq!(to_minutes_from_midnight(""), 0);
        assert_eq!(to_minutes_from_midnight("12:30"), 0);
    }

    #[test]
    fn test_weekday_monday() {
        assert_eq!(date_to_weekday_french("2025-01-06"), "Lundi");
    }

    #[test]
    fn test_weekday_tuesday() {
        assert_eq!(date_to_weekday_french("2025-01-07"), "Mardi");
    }

    #[test]
    fn test_weekday_wednesday() {
        assert_eq!(date_to_weekday_french("2025-01-08"), "Mercredi");
    }

    #[test]
    fn test_weekday_thursday() {
        assert_eq!(date_to_weekday_french("2025-01-09"), "Jeudi");
    }

    #[test]
    fn test_weekday_friday() {
        assert_eq!(date_to_weekday_french("2025-01-10"), "Vendredi");
    }

    #[test]
    fn test_weekday_saturday() {
        assert_eq!(date_to_weekday_french("2025-01-11"), "Samedi");
    }

    #[test]
    fn test_weekday_sunday() {
        assert_eq!(date_to_weekday_french("2025-01-12"), "Dimanche");
    }

    #[test]
    fn test_weekday_invalid_date() {
        assert_eq!(date_to_weekday_french("invalid"), "Inconnu");
        assert_eq!(date_to_weekday_french("2025-13-01"), "Inconnu");
        assert_eq!(date_to_weekday_french(""), "Inconnu");
    }
}
