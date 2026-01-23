import { useState } from "react";
import "./TeamManager.css";
import { AssistantProfile } from "../../types";
import { LuCheck, LuTrash2, LuUserRoundPen, LuX } from "react-icons/lu";

interface Props {
  team: AssistantProfile[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: number, name: string, color: string) => void;
  onDelete: (id: number) => void;
}

export const TeamManager = ({ team, onAdd, onUpdate, onDelete }: Props) => {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4dabf7");

  // ID de l'AM en cours d'édition (null si aucun)
  const [editingId, setEditingId] = useState<number | null>(null);
  // Valeurs temporaires pour l'édition
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleStartEdit = (am: AssistantProfile) => {
    setEditingId(am.id);
    setEditName(am.name);
    setEditColor(am.color);
  };

  const handleSaveEdit = () => {
    if (editingId !== null && editName.trim()) {
      onUpdate(editingId, editName, editColor);
      setEditingId(null);
    }
  };

  return (
    <div className="team-manager">
      {team.length === 0 ? (
        <div className="team-empty-state">
          <p className="empty-message">Aucun membre dans l'équipe</p>
          <p className="empty-hint">
            Ajoutez des assistants maternels pour commencer à planifier.
          </p>
        </div>
      ) : (
        <ul className="team-list">
          {team.map((am) => (
          <li key={am.id} className="team-item">
            {editingId === am.id ? (
              // MODE EDITION
              <div className="edit-row">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                />
                <button className="btn-icon save" onClick={handleSaveEdit}>
                  <LuCheck />
                </button>
                <button
                  className="btn-icon cancel"
                  onClick={() => setEditingId(null)}
                >
                  <LuX />
                </button>
              </div>
            ) : (
              // MODE AFFICHAGE
              <>
                <span
                  className="color-dot"
                  style={{ backgroundColor: am.color }}
                ></span>
                <span className="am-name">{am.name}</span>
                <div className="actions">
                  <button
                    className="btn-icon"
                    onClick={() => handleStartEdit(am)}
                    title="Modifier"
                  >
                    <LuUserRoundPen />
                  </button>
                  <button
                    className="btn-icon delete"
                    onClick={() => onDelete(am.id)}
                    title="Supprimer"
                  >
                    <LuTrash2 />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        </ul>
      )}

      {/* Formulaire d'ajout */}
      <div className="add-am-form">
        <div className="form-row">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <input
            type="text"
            placeholder="Nouveau membre..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className={"btn-primary"}
            onClick={() => {
              if (newName) {
                onAdd(newName, newColor);
                setNewName("");
              }
            }}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
};
