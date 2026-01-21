import { Child, Day } from "../../types";
import { minutesToTime, formatDate } from "../../utils/formatters";
import "./DayTable.css";
import {
  LuTrash2,
  LuX,
  LuUsers,
  LuClock,
  LuTriangleAlert,
  LuPlus,
} from "react-icons/lu";
import { useState, useMemo } from "react";

interface Props {
  day: Day;
  onDeleteChild: (date: string, name: string) => void;
  onDeleteDay: () => void;
  onUpdateRatio?: (ratio: number) => void;
  onAddChild?: (name: string, start: string, end: string) => void;
}

export const DayTable = ({
  day,
  onDeleteChild,
  onDeleteDay,
  onUpdateRatio,
  onAddChild,
}: Props) => {
  const [enfants, setEnfants] = useState<Child[]>(day.enfants);
  const [ratio, setRatio] = useState<number>(day.ratio);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // État du formulaire d'ajout d'enfant
  const [newChildName, setNewChildName] = useState("");
  const [newStart, setNewStart] = useState("08h00");
  const [newEnd, setNewEnd] = useState("17h00");

  const handleDeleteChild = (name: string) => {
    if (!enfants) return;
    const updatedEnfants = enfants.filter((child) => child.nom !== name);
    setEnfants(updatedEnfants);
    onDeleteChild(day.date, name);
  };

  const handleRatioChange = (newRatio: number) => {
    if (newRatio < 1 || newRatio > 10) return;
    setRatio(newRatio);
    onUpdateRatio?.(newRatio);
  };

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !onAddChild) return;
    onAddChild(newChildName.trim(), newStart, newEnd);
    // Ajout optimiste à la liste locale
    const newChild: Child = {
      nom: newChildName.trim(),
      heures: [], // La vraie plage sera ajoutée côté backend
    };
    // On vérifie si l'enfant existe déjà (fusion des plages)
    const existingChild = enfants.find((c) => c.nom === newChildName.trim());
    if (!existingChild) {
      setEnfants([...enfants, newChild]);
    }
    setNewChildName("");
  };

  // Statistiques du jour
  const stats = useMemo(() => {
    const totalEnfants = enfants.length;
    const totalHeures = enfants.reduce((acc, child) => {
      return (
        acc +
        child.heures.reduce((h, range) => h + (range.depart - range.arrivee), 0)
      );
    }, 0);
    const heuresFormatees = Math.floor(totalHeures / 60);
    const minutesRestantes = totalHeures % 60;

    // Trouver les horaires min/max
    let minArrivee = Infinity;
    let maxDepart = 0;
    enfants.forEach((child) => {
      child.heures.forEach((h) => {
        if (h.arrivee < minArrivee) minArrivee = h.arrivee;
        if (h.depart > maxDepart) maxDepart = h.depart;
      });
    });

    return {
      totalEnfants,
      heuresFormatees,
      minutesRestantes,
      plageHoraire:
        minArrivee < Infinity
          ? `${minutesToTime(minArrivee)} - ${minutesToTime(maxDepart)}`
          : "—",
    };
  }, [enfants]);

  return (
    <div className="day-detail">
      {/* En-tête avec date et stats */}
      <div className="day-detail-header">
        <div className="day-detail-title">
          <span className="day-name">{day.jour}</span>
          <span className="day-date">{formatDate(day.date)}</span>
        </div>

        <div className="day-stats">
          <div className="stat-item">
            <LuUsers size={18} />
            <span className="stat-value">{stats.totalEnfants}</span>
            <span className="stat-label">enfants</span>
          </div>
          <div className="stat-item">
            <LuClock size={18} />
            <span className="stat-value">{stats.plageHoraire}</span>
            <span className="stat-label">amplitude</span>
          </div>
        </div>
      </div>

      {/* Contrôle du ratio */}
      <div className="ratio-section">
        <div className="ratio-info">
          <span className="ratio-title">Ratio enfants/AM</span>
          <span className="ratio-description">
            Nombre maximum d'enfants par assistant maternel
          </span>
        </div>
        <div className="ratio-control">
          <button
            className="ratio-btn"
            onClick={() => handleRatioChange(ratio - 1)}
            disabled={ratio <= 1}
          >
            −
          </button>
          <span className="ratio-value">{ratio}</span>
          <button
            className="ratio-btn"
            onClick={() => handleRatioChange(ratio + 1)}
            disabled={ratio >= 10}
          >
            +
          </button>
        </div>
      </div>

      {/* Liste des enfants */}
      <div className="children-section">
        <h4 className="section-title">
          <LuUsers size={16} />
          Enfants présents ({enfants.length})
        </h4>

        {enfants.length === 0 ? (
          <div className="empty-state">
            <p>Aucun enfant prévu ce jour</p>
          </div>
        ) : (
          <div className="children-list">
            {enfants.map((child) => (
              <div key={child.nom} className="child-card">
                <div className="child-info">
                  <span className="child-name">{child.nom}</span>
                  <div className="child-hours">
                    {child.heures.map((h, i) => (
                      <span key={i} className="time-badge">
                        {minutesToTime(h.arrivee)} → {minutesToTime(h.depart)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="btn-delete-child"
                  onClick={() => handleDeleteChild(child.nom)}
                  title="Supprimer cet enfant"
                >
                  <LuX size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulaire ajout enfant */}
      {onAddChild && (
        <div className="add-child-section">
          <h4 className="section-title">
            <LuPlus size={16} />
            Ajouter un enfant
          </h4>
          <form onSubmit={handleAddChild} className="add-child-form">
            <input
              type="text"
              placeholder="Nom de l'enfant"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              className="input-name"
              required
            />
            <div className="time-inputs">
              <input
                type="text"
                placeholder="08h00"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                pattern="\d{1,2}h\d{2}"
                title="Format: 08h00"
                className="input-time"
              />
              <span className="time-separator">→</span>
              <input
                type="text"
                placeholder="17h00"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                pattern="\d{1,2}h\d{2}"
                title="Format: 17h00"
                className="input-time"
              />
            </div>
            <button type="submit" className="btn-add-child">
              <LuPlus size={16} />
              Ajouter
            </button>
          </form>
        </div>
      )}

      {/* Zone de danger */}
      <div className="danger-zone">
        {!confirmDelete ? (
          <button
            className="btn-danger-outline"
            onClick={() => setConfirmDelete(true)}
          >
            <LuTrash2 size={16} />
            <span>Supprimer cette journée</span>
          </button>
        ) : (
          <div className="confirm-delete">
            <div className="confirm-message">
              <LuTriangleAlert size={20} />
              <span>Êtes-vous sûr ? Cette action est irréversible.</span>
            </div>
            <div className="confirm-actions">
              <button
                className="btn-cancel"
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </button>
              <button className="btn-danger" onClick={onDeleteDay}>
                Confirmer la suppression
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
