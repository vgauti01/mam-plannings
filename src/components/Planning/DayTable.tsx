import { Child, Day } from "../../types";
import { minutesToTime, formatDate } from "../../utils/formatters";
import "./DayTable.css";
import { LuTrash2, LuX } from "react-icons/lu";
import { useState } from "react";

interface Props {
  day: Day;
  onDeleteChild: (date: string, name: string) => void;
  onDeleteDay: () => void;
}

export const DayTable = ({ day, onDeleteChild, onDeleteDay }: Props) => {
  const [enfants, setEnfants] = useState<Child[]>(day.enfants);

  const handleDeleteChild = (name: string) => {
    if (!enfants) return;
    const updatedEnfants = enfants.filter((child) => child.nom !== name);
    setEnfants(updatedEnfants);
    onDeleteChild(day.date, name);
  };

  return (
    <div className="day-card">
      <div className="day-header">
        <h3>{formatDate(day.date)}</h3>
        <button className="btn-danger-outline" onClick={onDeleteDay}>
          <LuTrash2 /> <span>Supprimer cette journée</span>
        </button>
      </div>

      <table className="planning-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Nom / ID</th>
            <th>Horaires</th>
            <th className="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {/* LISTE DES ENFANTS */}
          {enfants &&
            enfants.map((child) => (
              <tr key={child.nom} className="row-child">
                <td>
                  <span className="badge child">Enfant</span>
                </td>
                <td>{child.nom}</td>
                <td>
                  {child.heures.map((h, i) => (
                    <span key={i} className="time-pill">
                      {minutesToTime(h.arrivee)} - {minutesToTime(h.depart)}
                    </span>
                  ))}
                </td>
                <td>
                  <button
                    className="btn-danger-outline"
                    onClick={() => handleDeleteChild(child.nom)}
                  >
                    <LuX size={16} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};
