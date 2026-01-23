import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayTable } from "./DayTable";
import { Day } from "../../types";

describe("DayTable", () => {
  const createMockDay = (overrides: Partial<Day> = {}): Day => ({
    date: "2025-01-06",
    jour: "Lundi",
    enfants: [
      {
        nom: "Alice D.",
        heures: [{ arrivee: 480, depart: 1020 }], // 8h - 17h
      },
      {
        nom: "Bob M.",
        heures: [{ arrivee: 540, depart: 960 }], // 9h - 16h
      },
    ],
    am: [
      {
        am_id: 0,
        heures: [{ arrivee: 480, depart: 1020 }],
      },
    ],
    ratio: 4,
    ...overrides,
  });

  it("affiche le nombre d'enfants", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    // Le nombre "2" devrait être affiché dans stat-value
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("enfants")).toBeInTheDocument();
  });

  it("affiche la liste des enfants", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    expect(screen.getByText("Alice D.")).toBeInTheDocument();
    expect(screen.getByText("Bob M.")).toBeInTheDocument();
  });

  it("affiche les horaires des enfants", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    // Vérifie que les horaires sont affichés (peut être multiple éléments)
    expect(screen.getAllByText(/08h00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/17h00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/09h00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/16h00/).length).toBeGreaterThan(0);
  });

  it("affiche le ratio dans le header", () => {
    const day = createMockDay({ ratio: 4 });
    render(
      <DayTable
        day={day}
        onDeleteChild={vi.fn()}
        onDeleteDay={vi.fn()}
        onUpdateRatio={vi.fn()}
      />
    );

    // Vérifie que le ratio est affiché
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("appelle onDeleteChild quand on supprime un enfant", () => {
    const onDeleteChild = vi.fn();
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={onDeleteChild} onDeleteDay={vi.fn()} />
    );

    // Trouve tous les boutons de suppression d'enfant
    const deleteButtons = screen.getAllByTitle("Supprimer cet enfant");
    fireEvent.click(deleteButtons[0]);

    expect(onDeleteChild).toHaveBeenCalledWith("2025-01-06", "Alice D.");
  });

  it("affiche le formulaire d'ajout d'enfant quand onAddChild est fourni", () => {
    const day = createMockDay();
    render(
      <DayTable
        day={day}
        onDeleteChild={vi.fn()}
        onDeleteDay={vi.fn()}
        onAddChild={vi.fn()}
      />
    );

    expect(screen.getByText(/ajouter un enfant/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nom de l'enfant/i)).toBeInTheDocument();
  });

  it("n'affiche pas le formulaire d'ajout sans onAddChild", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    expect(screen.queryByText(/ajouter un enfant/i)).not.toBeInTheDocument();
  });

  it("appelle onAddChild avec les bonnes valeurs", () => {
    const onAddChild = vi.fn();
    const day = createMockDay();
    render(
      <DayTable
        day={day}
        onDeleteChild={vi.fn()}
        onDeleteDay={vi.fn()}
        onAddChild={onAddChild}
      />
    );

    const nameInput = screen.getByPlaceholderText(/nom de l'enfant/i);
    fireEvent.change(nameInput, { target: { value: "Charlie P." } });

    const form = nameInput.closest("form");
    if (form) {
      fireEvent.submit(form);
    }

    expect(onAddChild).toHaveBeenCalledWith("Charlie P.", "08h00", "17h00");
  });

  it("affiche le bouton de suppression du jour", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    expect(screen.getByText(/supprimer cette journée/i)).toBeInTheDocument();
  });

  it("gère un jour sans enfants", () => {
    const day = createMockDay({ enfants: [] });
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    // "0" devrait être affiché
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("affiche le jour et la date", () => {
    const day = createMockDay();
    render(
      <DayTable day={day} onDeleteChild={vi.fn()} onDeleteDay={vi.fn()} />
    );

    expect(screen.getByText("Lundi")).toBeInTheDocument();
    // La date formatée devrait contenir "janvier"
    expect(screen.getByText(/janvier/i)).toBeInTheDocument();
  });
});
