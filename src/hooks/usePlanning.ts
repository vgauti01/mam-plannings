// src/hooks/usePlanning.ts
import { useState, useEffect } from "react";
import { Day, TimeRange } from "../types";
import { planningService } from "../services/planningService";
import { open } from "@tauri-apps/plugin-dialog";

/**
 * Type de retour du hook usePlanning.
 * Contient les jours, les fonctions de gestion et les états de chargement/erreur.
 * @param {Day[]} days - La liste des jours du planning.
 * @param {(date: string) => Promise<void> } handleRemoveDay - Fonction pour supprimer un jour.
 * @param {(date: string, id1: number, id2: number) => Promise<void> handleSwap - Fonction pour échanger deux shifts.
 * @param {() => Promise<void>} handleImportPdf - Fonction pour importer un fichier PDF.
 * @param {(date: string, name: string, start: string, end: string) => Promise<void>} handleAddEntry - Fonction pour ajouter une entrée manuelle.
 * @param {(date: string, childName: string) => Promise<void>} handleDeleteChild - Fonction pour supprimer un enfant d'un jour.
 * @param {(date: string, amId: number, newRanges: TimeRange[]) => Promise<void>} handleUpdateShift - Fonction pour mettre à jour un shift AM.
 * @param {boolean} loading - Indicateur de chargement.
 * @param {string | null} error - Message d'erreur s'il y en a un.
 */
interface UsePlanningReturn {
  days: Day[];
  handleRemoveDay: (date: string) => Promise<void>;
  handleSwap: (date: string, id1: number, id2: number) => Promise<void>;
  handleImportPdf: (
    year: number,
    ratio: number,
    active_team_ids: number[]
  ) => Promise<void>;
  handleAddEntry: (
    date: string,
    name: string,
    start: string,
    end: string
  ) => Promise<void>;
  handleDeleteChild: (date: string, childName: string) => Promise<void>;
  handleUpdateShift: (
    date: string,
    amId: number,
    newRanges: TimeRange[]
  ) => Promise<void>;
  handleUpdateRatio: (date: string, ratio: number) => Promise<void>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook personnalisé pour gérer la logique de planification.
 * Fournit les données et les fonctions nécessaires pour interagir avec le planning.
 * @return {UsePlanningReturn} Objet contenant les jours, les fonctions de gestion et les états de chargement/erreur.
 */
export const usePlanning = (): UsePlanningReturn => {
  // États locaux
  const [days, setDays] = useState<Day[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Charge le planning depuis le service.
   * Met à jour l'état des jours, du chargement et des erreurs en conséquence.
   * @return {Promise<void>}
   */
  const loadPlanning = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await planningService.getAll();
      setDays(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Charger au démarrage
  useEffect(() => {
    void loadPlanning();
  }, []);

  /**
   * Gère l'importation d'un fichier PDF.
   * Ouvre une boîte de dialogue pour sélectionner le fichier, puis importe le planning.
   * Met à jour l'état des jours, du chargement et des erreurs en conséquence.
   * @return {Promise<void>}
   */
  const handleImportPdf = async (
    year: number,
    ratio: number,
    active_team_ids: number[]
  ): Promise<void> => {
    try {
      // 1. On ouvre la boîte de dialogue d'abord
      const file = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      // Si l'utilisateur a sélectionné un fichier
      if (file) {
        // 2. DÉBUT DU CHARGEMENT
        setLoading(true);

        const updated = await planningService.importPdf(
          file,
          year,
          ratio,
          active_team_ids
        );

        setDays(updated);
      }
    } catch (err) {
      setError("Erreur import: " + String(err));
    } finally {
      // 3. FIN DU CHARGEMENT (Quoi qu'il arrive, succès ou erreur)
      setLoading(false);
    }
  };

  /**
   * Gère l'ajout d'une entrée manuelle au planning.
   * Met à jour l'état des jours et des erreurs en conséquence.
   * @param {string} date - La date du jour à modifier.
   * @param {string} name - Le nom de l'enfant.
   * @param {string} start - L'heure de début.
   * @param {string} end - L'heure de fin.
   * @return {Promise<void>}
   */
  const handleAddEntry = async (
    date: string,
    name: string,
    start: string,
    end: string
  ): Promise<void> => {
    try {
      const updated = await planningService.addManualEntry(
        date,
        name,
        start,
        end
      );
      setDays(updated);
    } catch (err) {
      setError(String(err));
    }
  };

  /**
   * Gère la suppression d'un enfant d'un jour spécifique.
   * Met à jour l'état des jours et des erreurs en conséquence.
   * @param {string} date - La date du jour à modifier.
   * @param {string} childName - Le nom de l'enfant à supprimer.
   * @return {Promise<void>}
   */
  const handleDeleteChild = async (
    date: string,
    childName: string
  ): Promise<void> => {
    try {
      const updated = await planningService.removeChild(date, childName);
      setDays(updated);
    } catch (err) {
      setError(String(err));
    }
  };

  /**
   * Gère la suppression d'un jour complet du planning.
   * Met à jour l'état des jours en conséquence.
   * @param {string} date - La date du jour à supprimer.
   * @return {Promise<void>}
   */
  const handleRemoveDay = async (date: string): Promise<void> => {
    try {
      const updated = await planningService.removeDay(date);
      setDays(updated); // Met à jour la liste des jours
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Gère l'échange de deux shifts dans un jour spécifique.
   * Met à jour l'état des jours en conséquence.
   * @param {string} date - La date du jour à modifier.
   * @param {number} id1 - L'ID du premier shift.
   * @param {number} id2 - L'ID du second shift.
   * @return {Promise<void>}
   */
  const handleSwap = async (
    date: string,
    id1: number,
    id2: number
  ): Promise<void> => {
    try {
      const updated = await planningService.swapShifts(date, id1, id2);
      setDays(updated);
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Met à jour les horaires d'un assistant maternel pour un jour donné.
   * @param {string} date - La date du jour à modifier.
   * @param {number} amId - L'ID de l'assistant maternel.
   * @param {TimeRange[]} newRanges - Les nouvelles plages horaires.
   * @return {Promise<void>}
   */
  const handleUpdateShift = async (
    date: string,
    amId: number,
    newRanges: TimeRange[]
  ): Promise<void> => {
    try {
      const updated = await planningService.updateAssistantShift(
        date,
        amId,
        newRanges
      );
      setDays(updated);
    } catch (e) {
      console.error(e);
    }
  };

  /**
   * Met à jour le ratio enfants/AM pour un jour donné.
   * @param {string} date - La date du jour à modifier.
   * @param {number} ratio - Le nouveau ratio.
   * @return {Promise<void>}
   */
  const handleUpdateRatio = async (
    date: string,
    ratio: number
  ): Promise<void> => {
    try {
      const updated = await planningService.updateDayRatio(date, ratio);
      setDays(updated);
    } catch (e) {
      console.error(e);
    }
  };

  return {
    days,
    handleRemoveDay,
    handleSwap,
    handleImportPdf,
    handleAddEntry,
    handleDeleteChild,
    handleUpdateShift,
    handleUpdateRatio,
    loading,
    error,
  };
};
