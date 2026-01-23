// src/hooks/usePlanning.ts
import { useState, useEffect } from "react";
import { Day, TimeRange } from "../types";
import { planningService } from "../services/planningService";
import { open } from "@tauri-apps/plugin-dialog";
import { useToast } from "../contexts/ToastContext";

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

  // Toast notifications
  const toast = useToast();

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
        setError(null); // Effacer l'erreur précédente

        const updated = await planningService.importPdf(
          file,
          year,
          ratio,
          active_team_ids
        );

        setDays(updated);
        toast.success(`Planning importé avec succès (${updated.length} jours)`);
      }
    } catch (err) {
      const errorMsg = String(err);
      setError(errorMsg);
      toast.error("Erreur lors de l'import du PDF");
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
      setError(null);
      const updated = await planningService.addManualEntry(
        date,
        name,
        start,
        end
      );
      setDays(updated);
      toast.success(`${name} ajouté(e) au planning`);
    } catch (err) {
      const errorMsg = String(err);
      // Message d'erreur plus clair pour la validation des horaires
      if (errorMsg.includes("doit être avant")) {
        toast.error("L'heure d'arrivée doit être avant l'heure de départ");
      } else {
        toast.error("Erreur lors de l'ajout de l'enfant");
      }
      setError(errorMsg);
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
      setError(null);
      const updated = await planningService.removeChild(date, childName);
      setDays(updated);
      toast.success(`${childName} retiré(e) du planning`);
    } catch (err) {
      setError(String(err));
      toast.error("Erreur lors de la suppression");
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
      setError(null);
      const updated = await planningService.removeDay(date);
      setDays(updated);
      toast.success("Journée supprimée");
    } catch (err) {
      setError(String(err));
      toast.error("Erreur lors de la suppression du jour");
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
      setError(null);
      const updated = await planningService.swapShifts(date, id1, id2);
      setDays(updated);
      toast.success("Shifts échangés");
    } catch (err) {
      setError(String(err));
      toast.error("Erreur lors de l'échange");
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
      setError(null);
      const updated = await planningService.updateAssistantShift(
        date,
        amId,
        newRanges
      );
      setDays(updated);
      // Pas de toast pour les mises à jour de shift (trop fréquent avec drag-drop)
    } catch (err) {
      setError(String(err));
      toast.error("Erreur lors de la mise à jour du shift");
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
      setError(null);
      const updated = await planningService.updateDayRatio(date, ratio);
      setDays(updated);
      toast.info(`Ratio mis à jour: 1 AM pour ${ratio} enfants`);
    } catch (err) {
      setError(String(err));
      toast.error("Erreur lors de la mise à jour du ratio");
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
