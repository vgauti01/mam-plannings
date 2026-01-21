import { AssistantShift, Child } from "../types";

/**
 * Vérifie si une journée est en surcharge (plus d'enfants que d'AM × ratio).
 * Parcourt chaque minute de la journée pour détecter une surcharge.
 *
 * @param enfants - Liste des enfants présents
 * @param shifts - Liste des shifts des AM
 * @param ratio - Ratio enfants/AM (ex: 4)
 * @returns true si surcharge détectée, false sinon
 */
export const hasDaySurcharge = (
  enfants: Child[],
  shifts: AssistantShift[],
  ratio: number
): boolean => {
  // Plage de vérification : 7h à 20h (420 min à 1200 min)
  const startMinute = 420; // 7h
  const endMinute = 1200; // 20h

  for (let minute = startMinute; minute < endMinute; minute++) {
    const childCount = countPresenceAtMinute(enfants, minute);
    if (childCount === 0) continue; // Pas d'enfants = pas de problème

    const amCount = countAmAtMinute(shifts, minute);
    const capacity = amCount * ratio;

    if (childCount > capacity) {
      return true;
    }
  }

  return false;
};

/**
 * Compte le nombre d'enfants présents à une minute donnée.
 */
const countPresenceAtMinute = (enfants: Child[], minute: number): number => {
  let count = 0;
  for (const enfant of enfants) {
    for (const range of enfant.heures) {
      if (minute >= range.arrivee && minute < range.depart) {
        count++;
        break; // Un enfant ne peut être présent qu'une fois
      }
    }
  }
  return count;
};

/**
 * Compte le nombre d'AM présents à une minute donnée.
 */
const countAmAtMinute = (shifts: AssistantShift[], minute: number): number => {
  let count = 0;
  for (const shift of shifts) {
    for (const range of shift.heures) {
      if (minute >= range.arrivee && minute < range.depart) {
        count++;
        break; // Un AM ne peut être présent qu'une fois
      }
    }
  }
  return count;
};
