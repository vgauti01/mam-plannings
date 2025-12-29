import React, { useState } from "react";
import { AssistantProfile, Day, TimeRange } from "../../types";
import {
  formatDayLabel,
  isSameMonth,
  minutesToTime,
  formatDuration,
} from "../../utils/formatters";
import { TimelineEditor } from "./TimelineEditor";
import "./MonthlyTable.css";

interface Props {
  days: Day[];
  team: AssistantProfile[];
  currentMonth: Date;
  onDayClick: (day: Day) => void;
  onSwap: (date: string, amId1: number, amId2: number) => void;
  onShiftChange: (date: string, amId: number, newRanges: TimeRange[]) => void;
}

/**
 * Calcule le total de minutes pour un shift (somme de toutes les plages horaires)
 */
const getShiftTotalMinutes = (heures: TimeRange[]): number => {
  return heures.reduce((acc, range) => acc + (range.depart - range.arrivee), 0);
};

/**
 * Formate les horaires d'un shift pour l'affichage
 */
const formatShiftHours = (heures: TimeRange[]): string => {
  if (heures.length === 0) return "";
  if (heures.length === 1) {
    return `${minutesToTime(heures[0].arrivee)} - ${minutesToTime(heures[0].depart)}`;
  }
  // Si plusieurs plages, afficher la première et dernière heure
  const firstStart = Math.min(...heures.map((h) => h.arrivee));
  const lastEnd = Math.max(...heures.map((h) => h.depart));
  return `${minutesToTime(firstStart)} - ${minutesToTime(lastEnd)}`;
};

export const MonthlyTable = ({
  days,
  team,
  currentMonth,
  onDayClick,
  onSwap,
  onShiftChange,
}: Props) => {
  // État du Drag & Drop
  const [draggedData, setDraggedData] = useState<{
    date: string;
    amId: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    date: string;
    amId: number;
  } | null>(null);

  // État pour les lignes dépliées
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const toggleExpand = (date: string) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const monthDays = days.filter((d) => isSameMonth(d.date, currentMonth));

  // 1. Récupérer les IDs de l'équipe active (Configuration)
  const configIds = team.map((t) => t.id);

  // 2. Récupérer les IDs qui ont réellement des shifts dans les données (Données)
  const dataIds = new Set<number>();
  monthDays.forEach((d) => d.am.forEach((s) => dataIds.add(s.am_id)));

  // 3. Fusionner les deux listes, retirer les doublons et trier
  const amIds = Array.from(
    new Set([...configIds, ...Array.from(dataIds)])
  ).sort((a, b) => a - b);

  // Calcul dynamique des colonnes nécessaires
  let maxAmIdInData = 0;
  monthDays.forEach((d) =>
    d.am.forEach((s) => {
      if (s.am_id > maxAmIdInData) maxAmIdInData = s.am_id;
    })
  );

  const handleDragStart = (e: React.DragEvent, date: string, amId: number) => {
    setDraggedData({ date, amId });
    // Nécessaire pour Firefox
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ date, amId }));
  };

  const handleDragOver = (e: React.DragEvent, date: string, amId: number) => {
    // 1. CRUCIAL : Toujours empêcher le comportement par défaut pour autoriser le drop
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // 2. Gestion visuelle : On ne met à jour la cible que si c'est valide (même jour, colonne différente)
    if (draggedData && draggedData.date === date && draggedData.amId !== amId) {
      setDragOverTarget({ date, amId });
    }
  };

  const handleDrop = (e: React.DragEvent, date: string, targetAmId: number) => {
    e.preventDefault();

    if (
      draggedData &&
      draggedData.date === date &&
      draggedData.amId !== targetAmId
    ) {
      // Appel au parent pour faire l'échange
      onSwap(date, draggedData.amId, targetAmId);
    }

    // Reset des états
    setDraggedData(null);
    setDragOverTarget(null);
  };

  // Helpers affichage
  const getAmName = (id: number) =>
    team.find((t) => t.id === id)?.name || `AM ${id + 1}`;
  const getAmColor = (id: number) =>
    team.find((t) => t.id === id)?.color || "#e9ecef";

  // Totaux
  const amTotals = amIds.map((amId) => {
    let total = 0;
    monthDays.forEach((day) => {
      day.am
        .filter((s) => s.am_id === amId)
        .forEach((s) => {
          total += getShiftTotalMinutes(s.heures);
        });
    });
    return total;
  });

  return (
    <div className="table-container">
      <table className="monthly-grid">
        <thead>
          <tr>
            <th className="sticky-col">Date</th>
            {amIds.map((id) => (
              <th key={id} style={{ borderTop: `4px solid ${getAmColor(id)}` }}>
                {getAmName(id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthDays.map((day) => {
            const isExpanded = expandedDays.has(day.date);
            const hasShifts = day.am.length > 0;

            return (
              <React.Fragment key={day.date}>
                {/* Ligne principale */}
                <tr className={`day-row ${isExpanded ? "expanded" : ""}`}>
                  <td
                    className="date-cell sticky-col"
                    onClick={() => onDayClick(day)}
                  >
                    <div className="date-content">
                      <span className="day-name">
                        {formatDayLabel(day.date).split(" ")[0]}
                      </span>
                      <span className="day-num">
                        {formatDayLabel(day.date).split(" ")[1]}
                      </span>
                    </div>
                  </td>

                  {amIds.map((amId) => {
                    const shift = day.am.find((s) => s.am_id === amId);
                    const hasShift = shift && shift.heures.length > 0;

                    const isDragOver =
                      dragOverTarget?.date === day.date &&
                      dragOverTarget?.amId === amId;
                    const isDragging =
                      draggedData?.date === day.date &&
                      draggedData?.amId === amId;

                    return (
                      <td
                        key={`${day.date}-${amId}`}
                        className={`shift-cell ${hasShift ? "filled" : "empty"} ${isDragOver ? "drag-over" : ""} ${isDragging ? "dragging" : ""}`}
                        // DRAG EVENTS
                        draggable={hasShift}
                        onDragStart={(e) => handleDragStart(e, day.date, amId)}
                        onDragOver={(e) => handleDragOver(e, day.date, amId)}
                        onDrop={(e) => handleDrop(e, day.date, amId)}
                        // UX : On quitte la zone -> on nettoie la cible visuelle
                        onDragLeave={() => setDragOverTarget(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasShifts) {
                            toggleExpand(day.date);
                          }
                        }}
                      >
                        {hasShift && (
                          <div className="shift-pill">
                            {formatShiftHours(shift.heures)}
                          </div>
                        )}
                        {/* Aide visuelle au survol lors du drag */}
                        {isDragOver && !hasShift && (
                          <div className="ghost-pill">⇄ Déposer ici</div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Ligne dépliée avec TimelineEditor */}
                {isExpanded && (
                  <tr className="timeline-row">
                    <td colSpan={amIds.length + 1} className="timeline-cell">
                      <TimelineEditor
                        enfants={day.enfants}
                        shifts={day.am}
                        team={team}
                        ratio={day.ratio || 4}
                        onShiftChange={(amId, newRanges) =>
                          onShiftChange(day.date, amId, newRanges)
                        }
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky-col">
              <strong>TOTAL</strong>
            </td>
            {amTotals.map((total, idx) => (
              <td key={idx} className="total-cell">
                {formatDuration(total)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
