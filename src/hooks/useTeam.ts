// src/hooks/usePlanning.ts
import { useState, useEffect, useCallback } from "react";
import { AssistantProfile } from "../types";
import { planningService } from "../services/planningService";

/**
 * Type de retour du hook useTeam.
 * Contient l'équipe et les fonctions de gestion.
 * @param team {AssistantProfile[]} Liste des membres de l'équipe
 * @param handleAddTeammate {function} Fonction pour ajouter un membre
 * @param handleUpdateTeammate {function} Fonction pour mettre à jour un membre
 * @param handleRemoveTeammate {function} Fonction pour supprimer un membre
 */
interface UseTeamReturn {
  team: AssistantProfile[];
  handleAddTeammate: (name: string, color: string) => Promise<void>;
  handleUpdateTeammate: (
    id: number,
    name: string,
    color: string
  ) => Promise<void>;
  handleRemoveTeammate: (id: number) => Promise<void>;
}

/**
 * Hook personnalisé pour gérer l'équipe d'assistants.
 * Fournit des fonctions pour ajouter, mettre à jour et supprimer des membres de l'équipe.
 * @return {UseTeamReturn} Objet contenant l'équipe et les fonctions de gestion.
 */
export const useTeam = (): UseTeamReturn => {
  // État de l'équipe
  const [team, setTeam] = useState<AssistantProfile[]>([]);

  /**
   * Charge l'équipe depuis le service de planification.
   * @return {Promise<void>}
   */
  const loadTeam = useCallback(async () => {
    try {
      const t = await planningService.getTeam();
      setTeam(t);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Charger au démarrage
  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  /**
   * Ajoute un nouveau membre à l'équipe.
   *
   * @param name {string} Nom du membre
   * @param color {string} Couleur associée au membre
   */
  const handleAddTeammate = async (name: string, color: string) => {
    const updated = await planningService.addAssistant(name, color);
    setTeam(updated);
  };

  /**
   * Met à jour un membre de l'équipe.
   * @param id {number} ID du membre
   * @param name {string} Nouveau nom du membre
   * @param color {string} Nouvelle couleur associée au membre
   */
  const handleUpdateTeammate = async (
    id: number,
    name: string,
    color: string
  ) => {
    const updated = await planningService.updateAssistant(id, name, color);
    setTeam(updated);
  };

  /**
   * Supprime un membre de l'équipe.
   * @param id {number} ID du membre à supprimer
   */
  const handleRemoveTeammate = async (id: number) => {
    const updated = await planningService.removeAssistant(id);
    setTeam(updated);
  };

  return {
    team,
    handleAddTeammate,
    handleUpdateTeammate,
    handleRemoveTeammate,
  };
};
