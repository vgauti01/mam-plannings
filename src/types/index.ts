/**
 * Type représentant le profil d'un assistant maternel.
 * Chaque assistant a un identifiant unique, un nom et une couleur associée.
 *
 * @property {number} id - Identifiant unique de l'assistant.
 * @property {string} name - Nom de l'assistant.
 * @property {string} color - Couleur associée à l'assistant (format hexadécimal).
 */
export interface AssistantProfile {
  id: number;
  name: string;
  color: string;
}

/**
 * Type représentant une plage horaire avec une heure d'arrivée et de départ.
 * Les heures sont exprimées en minutes depuis minuit.
 *
 * @property {number} arrivee - Heure d'arrivée en minutes depuis minuit.
 * @property {number} depart - Heure de départ en minutes depuis minuit.
 */
export interface TimeRange {
  arrivee: number; // en minutes depuis minuit
  depart: number;
}

/**
 * Type représentant un enfant avec son nom et ses plages horaires.
 *
 * @property {string} nom - Nom de l'enfant.
 * @property {TimeRange[]} heures - Liste des plages horaires de l'enfant.
 */
export interface Child {
  nom: string;
  heures: TimeRange[];
}

/**
 * Type représentant le shift d'un assistant maternel pour une journée donnée.
 *
 * @property {number} am_id - Identifiant de l'assistant maternel.
 * @property {TimeRange[]} heures - Liste des plages horaires de l'assistant.
 */
export interface AssistantShift {
  am_id: number;
  heures: TimeRange[];
}

/**
 * Type représentant une journée dans le planning.
 *
 * @property {string} date - Date de la journée au format "YYYY-MM-DD".
 * @property {string} jour - Jour de la semaine en français ("Lundi", "Mardi", etc.).
 * @property {Child[]} enfants - Liste des enfants présents ce jour-là.
 * @property {AssistantShift[]} am - Liste des shifts des assistants maternels pour ce jour-là.
 * @property {number} ratio - Ratio enfants par assistant maternel.
 */
export interface Day {
  date: string; // "YYYY-MM-DD"
  jour: string; // "Lundi", "Mardi"...
  enfants: Child[];
  am: AssistantShift[];
  ratio: number; // Ratio enfants/AM (ex: 4)
}
