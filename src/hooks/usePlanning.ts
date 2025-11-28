// src/hooks/usePlanning.ts
import {useState, useEffect, useCallback} from "react";
import {AssistantProfile, Day, MonthSettings} from "../types";
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
 * @param {boolean} loading - Indicateur de chargement.
 * @param {string | null} error - Message d'erreur s'il y en a un.
 */
interface UsePlanningReturn {
  days: Day[];
  currentConfig: MonthSettings | null;
  handleRemoveDay: (date: string) => Promise<void>;
  handleSwap: (date: string, id1: number, id2: number) => Promise<void>;
  handleImportPdf: () => Promise<void>;
  handleAddEntry: (
    date: string,
    name: string,
    start: string,
    end: string
  ) => Promise<void>;
  handleDeleteChild: (date: string, childName: string) => Promise<void>;
  loadMonthConfig: (date: Date) => Promise<void>;
  handleSaveMonthConfig: (
    date: Date,
    ratio: number,
    activeTeam: AssistantProfile[]
  ) => Promise<void>;
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
  // Config actuelle (Ratio...)
  const [currentConfig, setCurrentConfig] = useState<MonthSettings | null>(null);

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

  // --- CHARGER LA CONFIG DU MOIS ---
  const loadMonthConfig = useCallback(async (date: Date) => {
    try {
      const y = date.getFullYear();
      const m = date.getMonth() + 1; // JS mois 0-11 -> Rust 1-12

      const config = await planningService.getMonthConfig(y, m);
      console.log(JSON.stringify(config))

      setCurrentConfig(config);
    } catch (e) {
      console.error("Erreur chargement config mois:", e);
    }
  }, []);

  // --- SAUVEGARDER LA CONFIG ---
  const handleSaveMonthConfig = async (date: Date, ratio: number, activeTeam: AssistantProfile[]) => {
    setLoading(true);
    try {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;

      // Le backend renvoie les jours recalculés
      const updatedDays = await planningService.updateMonthConfig(y, m, ratio, activeTeam);

      setDays(updatedDays);
      // On recharge la config pour être sûr d'être synchro
      await loadMonthConfig(date);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gère l'importation d'un fichier PDF.
   * Ouvre une boîte de dialogue pour sélectionner le fichier, puis importe le planning.
   * Met à jour l'état des jours, du chargement et des erreurs en conséquence.
   * @return {Promise<void>}
   */
  const handleImportPdf = async (): Promise<void> => {
    try {
      // 1. On ouvre la boîte de dialogue d'abord
      const file = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      // Si l'utilisateur a sélectionné un fichier
      if (file) {
        // Demander l'année du planning
        const currentYear = new Date().getFullYear();
        const userYearStr = window.prompt(
          "Pour quelle année est ce planning ?",
          String(currentYear)
        );
        if (userYearStr === null) return;

        const year = parseInt(userYearStr, 10);
        if (isNaN(year)) {
          alert("Année invalide.");
          return;
        }

        // 2. DÉBUT DU CHARGEMENT
        setLoading(true);

        const updated = await planningService.importPdf(file, year);

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

  return {
    days,
    currentConfig,
    handleRemoveDay,
    handleSwap,
    handleImportPdf,
    handleAddEntry,
    handleDeleteChild,
    loadMonthConfig,
    handleSaveMonthConfig,
    loading,
    error,
  };
};
