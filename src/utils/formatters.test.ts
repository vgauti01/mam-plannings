import { describe, it, expect } from "vitest";
import {
  minutesToTime,
  formatDuration,
  formatDate,
  formatMonthYear,
  isSameMonth,
  formatDayLabel,
} from "./formatters";

describe("minutesToTime", () => {
  it("convertit 0 minutes en 00h00", () => {
    expect(minutesToTime(0)).toBe("00h00");
  });

  it("convertit 60 minutes en 01h00", () => {
    expect(minutesToTime(60)).toBe("01h00");
  });

  it("convertit 150 minutes en 02h30", () => {
    expect(minutesToTime(150)).toBe("02h30");
  });

  it("convertit 480 minutes (8h) en 08h00", () => {
    expect(minutesToTime(480)).toBe("08h00");
  });

  it("convertit 1020 minutes (17h) en 17h00", () => {
    expect(minutesToTime(1020)).toBe("17h00");
  });

  it("convertit 1439 minutes (23h59) en 23h59", () => {
    expect(minutesToTime(1439)).toBe("23h59");
  });

  it("gère les minutes avec padding", () => {
    expect(minutesToTime(65)).toBe("01h05");
  });
});

describe("formatDuration", () => {
  it("formate 0 minutes en 0h00", () => {
    expect(formatDuration(0)).toBe("0h00");
  });

  it("formate 60 minutes en 1h00 (sans padding sur les heures)", () => {
    expect(formatDuration(60)).toBe("1h00");
  });

  it("formate 150 minutes en 2h30", () => {
    expect(formatDuration(150)).toBe("2h30");
  });

  it("formate 480 minutes en 8h00", () => {
    expect(formatDuration(480)).toBe("8h00");
  });

  it("formate les minutes avec padding", () => {
    expect(formatDuration(65)).toBe("1h05");
  });
});

describe("formatDate", () => {
  it("formate une date en français", () => {
    const result = formatDate("2025-01-06");
    // Le format exact dépend de la locale, on vérifie juste que ça contient le jour
    expect(result).toContain("6");
    expect(result.toLowerCase()).toContain("janvier");
  });

  it("formate une autre date", () => {
    const result = formatDate("2025-11-15");
    expect(result).toContain("15");
    expect(result.toLowerCase()).toContain("novembre");
  });
});

describe("formatMonthYear", () => {
  it("formate mois et année en français", () => {
    const date = new Date(2025, 0, 15); // Janvier 2025
    const result = formatMonthYear(date);
    expect(result.toLowerCase()).toContain("janvier");
    expect(result).toContain("2025");
  });

  it("formate novembre 2024", () => {
    const date = new Date(2024, 10, 1); // Novembre 2024
    const result = formatMonthYear(date);
    expect(result.toLowerCase()).toContain("novembre");
    expect(result).toContain("2024");
  });
});

describe("isSameMonth", () => {
  it("retourne true si même mois et année", () => {
    const currentDate = new Date(2025, 0, 15); // Janvier 2025
    expect(isSameMonth("2025-01-01", currentDate)).toBe(true);
    expect(isSameMonth("2025-01-31", currentDate)).toBe(true);
  });

  it("retourne false si mois différent", () => {
    const currentDate = new Date(2025, 0, 15); // Janvier 2025
    expect(isSameMonth("2025-02-01", currentDate)).toBe(false);
    expect(isSameMonth("2024-12-31", currentDate)).toBe(false);
  });

  it("retourne false si année différente", () => {
    const currentDate = new Date(2025, 0, 15); // Janvier 2025
    expect(isSameMonth("2024-01-15", currentDate)).toBe(false);
  });
});

describe("formatDayLabel", () => {
  it("formate une date en label court", () => {
    const result = formatDayLabel("2025-01-06"); // Lundi 6 janvier 2025
    // Devrait contenir le numéro du jour
    expect(result).toContain("6");
  });

  it("formate une autre date", () => {
    const result = formatDayLabel("2025-01-15");
    expect(result).toContain("15");
  });
});
