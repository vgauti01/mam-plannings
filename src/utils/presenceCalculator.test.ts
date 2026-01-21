import { describe, it, expect } from "vitest";
import { hasDaySurcharge } from "./presenceCalculator";
import { Child, AssistantShift } from "../types";

describe("hasDaySurcharge", () => {
  const createChild = (
    nom: string,
    arrivee: number,
    depart: number
  ): Child => ({
    nom,
    heures: [{ arrivee, depart }],
  });

  const createShift = (
    am_id: number,
    arrivee: number,
    depart: number
  ): AssistantShift => ({
    am_id,
    heures: [{ arrivee, depart }],
  });

  describe("avec ratio de 4", () => {
    const ratio = 4;

    it("retourne false quand aucun enfant", () => {
      const enfants: Child[] = [];
      const shifts: AssistantShift[] = [];
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(false);
    });

    it("retourne false quand 4 enfants et 1 AM (ratio respecté)", () => {
      const enfants = [
        createChild("Alice", 480, 1020), // 8h - 17h
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
      ];
      const shifts = [createShift(0, 480, 1020)]; // 1 AM de 8h à 17h
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(false);
    });

    it("retourne true quand 5 enfants et 1 AM (surcharge)", () => {
      const enfants = [
        createChild("Alice", 480, 1020),
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
        createChild("Eve", 480, 1020),
      ];
      const shifts = [createShift(0, 480, 1020)];
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(true);
    });

    it("retourne false quand 8 enfants et 2 AM", () => {
      const enfants = Array.from({ length: 8 }, (_, i) =>
        createChild(`Enfant${i}`, 480, 1020)
      );
      const shifts = [createShift(0, 480, 1020), createShift(1, 480, 1020)];
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(false);
    });

    it("retourne true quand 9 enfants et 2 AM", () => {
      const enfants = Array.from({ length: 9 }, (_, i) =>
        createChild(`Enfant${i}`, 480, 1020)
      );
      const shifts = [createShift(0, 480, 1020), createShift(1, 480, 1020)];
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(true);
    });
  });

  describe("détection de surcharge partielle", () => {
    const ratio = 4;

    it("détecte la surcharge même sur une courte période", () => {
      // 5 enfants arrivent à 8h, mais 1 AM n'arrive qu'à 9h
      const enfants = [
        createChild("Alice", 480, 1020), // 8h - 17h
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
        createChild("Eve", 480, 1020),
      ];
      const shifts = [
        createShift(0, 480, 1020), // 8h - 17h
        createShift(1, 540, 1020), // 9h - 17h (arrive 1h après)
      ];
      // De 8h à 9h: 5 enfants, 1 AM -> surcharge
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(true);
    });

    it("pas de surcharge si les AM couvrent bien", () => {
      const enfants = [
        createChild("Alice", 480, 1020),
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
        createChild("Eve", 540, 1020), // Eve arrive à 9h seulement
      ];
      const shifts = [
        createShift(0, 480, 1020),
        createShift(1, 540, 1020), // 2ème AM arrive quand Eve arrive
      ];
      // De 8h à 9h: 4 enfants, 1 AM -> OK
      // De 9h à 17h: 5 enfants, 2 AM -> OK
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(false);
    });
  });

  describe("enfants avec plusieurs plages horaires", () => {
    const ratio = 4;

    it("compte correctement un enfant avec 2 plages", () => {
      const enfants: Child[] = [
        {
          nom: "Alice",
          heures: [
            { arrivee: 480, depart: 720 }, // 8h - 12h
            { arrivee: 840, depart: 1020 }, // 14h - 17h
          ],
        },
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
        createChild("Eve", 480, 1020),
      ];
      const shifts = [createShift(0, 480, 1020)];
      // Entre 8h et 12h: 5 enfants, 1 AM -> surcharge
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(true);
    });

    it("pas de surcharge si enfant absent à midi", () => {
      const enfants: Child[] = [
        {
          nom: "Alice",
          heures: [
            { arrivee: 480, depart: 720 }, // 8h - 12h seulement
          ],
        },
        createChild("Bob", 480, 1020),
        createChild("Charlie", 480, 1020),
        createChild("David", 480, 1020),
      ];
      const shifts = [createShift(0, 480, 1020)];
      // Max 4 enfants simultanés, 1 AM -> OK
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(false);
    });
  });

  describe("AM avec plusieurs plages horaires", () => {
    const ratio = 4;

    it("détecte la surcharge pendant l'absence de l'AM", () => {
      const enfants = Array.from({ length: 5 }, (_, i) =>
        createChild(`Enfant${i}`, 480, 1020)
      );
      const shifts: AssistantShift[] = [
        {
          am_id: 0,
          heures: [
            { arrivee: 480, depart: 720 }, // 8h - 12h
            { arrivee: 840, depart: 1020 }, // 14h - 17h
          ],
        },
        createShift(1, 480, 1020), // Présent toute la journée
      ];
      // Entre 12h et 14h: 5 enfants, 1 AM -> surcharge
      expect(hasDaySurcharge(enfants, shifts, ratio)).toBe(true);
    });
  });

  describe("avec différents ratios", () => {
    it("ratio de 3: surcharge avec 4 enfants et 1 AM", () => {
      const enfants = Array.from({ length: 4 }, (_, i) =>
        createChild(`Enfant${i}`, 480, 1020)
      );
      const shifts = [createShift(0, 480, 1020)];
      expect(hasDaySurcharge(enfants, shifts, 3)).toBe(true);
    });

    it("ratio de 5: pas de surcharge avec 5 enfants et 1 AM", () => {
      const enfants = Array.from({ length: 5 }, (_, i) =>
        createChild(`Enfant${i}`, 480, 1020)
      );
      const shifts = [createShift(0, 480, 1020)];
      expect(hasDaySurcharge(enfants, shifts, 5)).toBe(false);
    });
  });

  describe("cas limites", () => {
    it("pas de surcharge si enfants en dehors de 7h-20h", () => {
      // Enfants présents seulement de 6h à 7h (hors plage de vérification)
      const enfants = Array.from({ length: 10 }, (_, i) =>
        createChild(`Enfant${i}`, 360, 420)
      );
      const shifts: AssistantShift[] = [];
      expect(hasDaySurcharge(enfants, shifts, 4)).toBe(false);
    });

    it("détecte surcharge si aucun AM mais enfants présents", () => {
      const enfants = [createChild("Alice", 480, 1020)];
      const shifts: AssistantShift[] = [];
      expect(hasDaySurcharge(enfants, shifts, 4)).toBe(true);
    });
  });
});
