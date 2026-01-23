import { useState, useCallback, useEffect } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T, actionName?: string) => void;
  undo: () => T | undefined;
  redo: () => T | undefined;
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
}

const MAX_HISTORY_SIZE = 20;

/**
 * Hook pour gérer l'historique des états avec undo/redo
 * @param initialState État initial
 * @returns Objet avec état courant et fonctions undo/redo
 */
export function useHistory<T>(initialState: T): UseHistoryReturn<T> {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Met à jour l'état et ajoute à l'historique
  const setState = useCallback((newState: T, actionName?: string) => {
    setHistory((prev) => {
      const newPast = [...prev.past, prev.present];
      // Limiter la taille de l'historique
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
      }
      return {
        past: newPast,
        present: newState,
        future: [], // Efface le futur lors d'une nouvelle action
      };
    });
    if (actionName) {
      setLastAction(actionName);
    }
  }, []);

  // Annuler la dernière action
  const undo = useCallback((): T | undefined => {
    let previousState: T | undefined;
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = [...prev.past];
      previousState = newPast.pop()!;

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      };
    });
    setLastAction(null);
    return previousState;
  }, []);

  // Rétablir l'action annulée
  const redo = useCallback((): T | undefined => {
    let nextState: T | undefined;
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const newFuture = [...prev.future];
      nextState = newFuture.shift()!;

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      };
    });
    return nextState;
  }, []);

  // Synchroniser avec un état externe (ex: après chargement initial)
  const syncState = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  // Exposer syncState via setState quand past est vide
  const setStateOrSync = useCallback(
    (newState: T, actionName?: string) => {
      if (history.past.length === 0 && !actionName) {
        syncState(newState);
      } else {
        setState(newState, actionName);
      }
    },
    [history.past.length, setState, syncState]
  );

  return {
    state: history.present,
    setState: setStateOrSync,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    lastAction,
  };
}

/**
 * Hook pour les raccourcis clavier globaux Undo/Redo
 */
export function useUndoRedoKeyboard(
  onUndo: () => void,
  onRedo: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si on est dans un input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+Z ou Cmd+Z pour Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      }
      // Ctrl+Shift+Z ou Cmd+Shift+Z pour Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        onRedo();
      }
      // Ctrl+Y pour Redo (Windows)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo, onRedo, enabled]);
}
