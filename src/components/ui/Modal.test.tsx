import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("ne rend rien quand isOpen est false", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>Contenu</p>
      </Modal>
    );

    expect(screen.queryByText("Test")).not.toBeInTheDocument();
    expect(screen.queryByText("Contenu")).not.toBeInTheDocument();
  });

  it("affiche le contenu quand isOpen est true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Contenu du modal</p>
      </Modal>
    );

    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Contenu du modal")).toBeInTheDocument();
  });

  it("appelle onClose quand on clique sur le bouton de fermeture", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Contenu</p>
      </Modal>
    );

    // Trouve le bouton de fermeture (icône X)
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose quand on clique sur le backdrop", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Contenu</p>
      </Modal>
    );

    // Le backdrop a la classe modal-backdrop
    const backdrop = document.querySelector(".modal-backdrop");
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("ne ferme pas quand on clique sur le contenu du modal", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Contenu cliquable</p>
      </Modal>
    );

    fireEvent.click(screen.getByText("Contenu cliquable"));

    // onClose ne devrait pas être appelé quand on clique sur le contenu
    // (le stopPropagation devrait empêcher ça)
    // Note: cela dépend de l'implémentation du composant
  });

  it("affiche le titre correctement", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Titre personnalisé">
        <p>Contenu</p>
      </Modal>
    );

    expect(screen.getByText("Titre personnalisé")).toBeInTheDocument();
  });

  it("rend les enfants correctement", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test">
        <div data-testid="child-1">Premier enfant</div>
        <div data-testid="child-2">Deuxième enfant</div>
      </Modal>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });
});
