import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthNavigation } from "./MonthNavigation";

describe("MonthNavigation", () => {
  it("affiche le mois et l'année courants", () => {
    const currentDate = new Date(2025, 0, 15); // Janvier 2025
    const onChange = vi.fn();

    render(<MonthNavigation currentDate={currentDate} onChange={onChange} />);

    // Vérifie que "janvier" et "2025" sont affichés
    expect(screen.getByText(/janvier/i)).toBeInTheDocument();
    expect(screen.getByText(/2025/i)).toBeInTheDocument();
  });

  it("appelle onChange avec le mois précédent quand on clique sur le bouton précédent", () => {
    const currentDate = new Date(2025, 5, 15); // Juin 2025
    const onChange = vi.fn();

    render(<MonthNavigation currentDate={currentDate} onChange={onChange} />);

    // Trouve le bouton précédent (premier bouton)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // Bouton précédent

    expect(onChange).toHaveBeenCalledTimes(1);
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getMonth()).toBe(4); // Mai
    expect(newDate.getFullYear()).toBe(2025);
  });

  it("appelle onChange avec le mois suivant quand on clique sur le bouton suivant", () => {
    const currentDate = new Date(2025, 5, 15); // Juin 2025
    const onChange = vi.fn();

    render(<MonthNavigation currentDate={currentDate} onChange={onChange} />);

    // Trouve le bouton suivant (dernier bouton)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]); // Bouton suivant

    expect(onChange).toHaveBeenCalledTimes(1);
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getMonth()).toBe(6); // Juillet
    expect(newDate.getFullYear()).toBe(2025);
  });

  it("gère le passage d'année (décembre -> janvier)", () => {
    const currentDate = new Date(2025, 11, 15); // Décembre 2025
    const onChange = vi.fn();

    render(<MonthNavigation currentDate={currentDate} onChange={onChange} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]); // Mois suivant

    expect(onChange).toHaveBeenCalledTimes(1);
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getMonth()).toBe(0); // Janvier
    expect(newDate.getFullYear()).toBe(2026);
  });

  it("gère le passage d'année (janvier -> décembre)", () => {
    const currentDate = new Date(2025, 0, 15); // Janvier 2025
    const onChange = vi.fn();

    render(<MonthNavigation currentDate={currentDate} onChange={onChange} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // Mois précédent

    expect(onChange).toHaveBeenCalledTimes(1);
    const newDate = onChange.mock.calls[0][0] as Date;
    expect(newDate.getMonth()).toBe(11); // Décembre
    expect(newDate.getFullYear()).toBe(2024);
  });
});
