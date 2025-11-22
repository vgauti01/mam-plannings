/**
 * Convertit des minutes depuis minuit en format "HHhMM"
 * Exemple : 150 -> "02h30"
 * @param minutes Le nombre de minutes depuis minuit
 * @return string au format "HHhMM"
 */
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}h${m.toString().padStart(2, "0")}`;
};

/**
 * Formate une durée en minutes au format "HhMM"
 * Exemple : 150 -> "2h30"
 * La différence avec minutesToTime est que ici on n'a pas de padding sur les heures.
 *
 * @param totalMinutes Le total de minutes
 * @return string au format "HhMM"
 */
export const formatDuration = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
};

/**
 * Formate une date string "YYYY-MM-DD" en format "Lundi 3 novembre"
 * Utilise l'API Intl.DateTimeFormat pour la localisation en français.
 *
 * @param dateStr La date au format string "YYYY-MM-DD"
 * @return string formatée en "Lundi 3 novembre"
 */
export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
};

/**
 * Formate une date en "mois année", ex: "novembre 2023"
 * Utilise l'API Intl.DateTimeFormat pour la localisation en français.
 *
 * @param date La date à formater
 * @return string formatée en "mois année"
 */
export const formatMonthYear = (date: Date): string => {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
};

/**
 * Vérifie si une date string "YYYY-MM-DD" est dans le même mois et année qu'une date donnée
 *
 * @param dateStr La date au format string "YYYY-MM-DD"
 * @param currentDate La date de référence
 * @return boolean true si même mois et année, false sinon
 */
export const isSameMonth = (dateStr: string, currentDate: Date): boolean => {
  const d = new Date(dateStr);
  return (
    d.getMonth() === currentDate.getMonth() &&
    d.getFullYear() === currentDate.getFullYear()
  );
};

/**
 * ZFormate une date string "YYYY-MM-DD" en format court "Lun 3"
 * Utilise l'API Intl.DateTimeFormat pour la localisation en français.
 *
 * @param dateStr La date au format string "YYYY-MM-DD"
 * @return string formatée en "Lun 3"
 */
export const formatDayLabel = (dateStr: string): string => {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
  }).format(d);
};
