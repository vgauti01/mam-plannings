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