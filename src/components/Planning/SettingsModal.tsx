import { useState, useEffect } from "react";
import { AssistantProfile } from "../../types";
import { planningService } from "../../services/planningService";
import "./SettingsModal.css";

interface Props {
  onSave: (year: number, ratio: number, team: number[]) => void;
  onClose: () => void;
}

export const SettingsModal = ({ onSave, onClose }: Props) => {
  // Liste des IDs sélectionnés pour ce mois
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [ratio, setRatio] = useState<number>(4);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Annuaire complet (chargé au montage)
  const [library, setLibrary] = useState<AssistantProfile[]>([]);

  useEffect(() => {
    // On charge tout l'annuaire pour proposer les choix
    planningService.getTeamLibrary().then(setLibrary);
  }, []);

  const toggleId = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSave = () => {
    onSave(year, ratio, selectedIds);
    onClose();
  };

  return (
    <div className="settings-container">
      {/* SECTION 1 : RATIO & ANNEE*/}
      <div className="setting-group">
        <label className="setting-label">Année du planning</label>
        <div className="ratio-control">
          <input
            type="number"
            min="2000"
            max="2200"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <label className="setting-label">Ratio Enfants / AM</label>
        <div className="ratio-control">
          <input
            type="number"
            min="1"
            max="12"
            value={ratio}
            onChange={(e) => setRatio(Number(e.target.value))}
          />
        </div>
      </div>

      <hr className="divider" />

      {/* SECTION 2 : ÉQUIPE */}
      <div className="setting-group">
        <label className="setting-label">Effectifs du mois</label>
        <p className="hint">
          Cochez les personnes présentes sur le planning ce mois-ci.
        </p>

        <div className="library-grid">
          {library.map((am) => {
            const isSelected = selectedIds.includes(am.id);
            return (
              <div
                key={am.id}
                className={`am-card ${isSelected ? "selected" : ""}`}
                onClick={() => toggleId(am.id)}
                style={{ borderLeftColor: am.color }}
              >
                <div className="checkbox-visual">{isSelected && "✔"}</div>
                <span>{am.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" onClick={handleSave}>
          Valider
        </button>
      </div>
    </div>
  );
};
