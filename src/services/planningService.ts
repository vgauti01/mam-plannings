// src/services/planningService.ts
import { invoke } from "@tauri-apps/api/core";
import { AssistantProfile, Day, TimeRange } from "../types";

/**
 * Service qui permet de faire le lien entre le frontend et le backend pour la gestion du planning.
 * Chaque méthode correspond à une commande Tauri définie dans le backend.
 */
export const planningService = {
  // --- GESTION PLANNING ---
  async getAll(): Promise<Day[]> {
    return await invoke("get_planning");
  },

  async restorePlanning(days: Day[]): Promise<Day[]> {
    return await invoke("restore_planning", { days });
  },

  async importPdf(
    path: string,
    year: number,
    ratio: number,
    activeTeamIds: number[]
  ): Promise<Day[]> {
    return await invoke("import_planning_pdf", {
      path,
      year,
      ratio,
      activeTeamIds,
    });
  },

  async addManualEntry(
    date: string,
    childName: string,
    arrivee: string,
    depart: string
  ): Promise<Day[]> {
    return await invoke("add_manual_entry", {
      date,
      childName,
      arrivee,
      depart,
    });
  },

  async removeChild(date: string, childName: string): Promise<Day[]> {
    return await invoke("remove_child", { date, childName });
  },

  async removeDay(date: string): Promise<Day[]> {
    return await invoke("remove_day", { date });
  },

  async swapShifts(date: string, amId1: number, amId2: number): Promise<Day[]> {
    return await invoke("swap_shifts", {
      date,
      amId1: amId1,
      amId2: amId2,
    });
  },

  // --- GESTION ANNUAIRE GLOBAL ---
  async getTeamLibrary(): Promise<AssistantProfile[]> {
    return await invoke("get_team_library");
  },

  // Note: add/update/remove_assistant agissent maintenant sur la LIBRAIRIE
  async addAssistant(name: string, color: string): Promise<AssistantProfile[]> {
    return await invoke("add_assistant", { name, color });
  },

  async updateAssistant(
    id: number,
    name: string,
    color: string
  ): Promise<AssistantProfile[]> {
    return await invoke("update_assistant", { id, name, color });
  },

  async removeAssistant(id: number): Promise<AssistantProfile[]> {
    return await invoke("remove_assistant", { id });
  },

  async updateAssistantShift(
    date: string,
    amId: number,
    newRanges: TimeRange[]
  ): Promise<Day[]> {
    return await invoke("edit_assistant_shift", {
      date,
      amId,
      newRanges,
    });
  },

  async updateDayRatio(date: string, ratio: number): Promise<Day[]> {
    return await invoke("update_day_ratio", { date, ratio });
  },
};
