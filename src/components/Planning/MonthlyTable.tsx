import React, { useState, useMemo, useCallback } from "react";
import { AssistantProfile, Day, TimeRange } from "../../types";
import {
  formatDayLabel,
  isSameMonth,
  minutesToTime,
  formatDuration,
} from "../../utils/formatters";
import { hasDaySurcharge } from "../../utils/presenceCalculator";
import { TimelineEditor } from "./TimelineEditor";
import { EmptyState } from "../ui/EmptyState";
import { LuCalendar } from "react-icons/lu";
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

  const toggleExpand = useCallback((date: string) => {
    setExpandedDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }, []);

  // Filtrer les jours du mois courant (mémoïsé)
  const monthDays = useMemo(
    () => days.filter((d) => isSameMonth(d.date, currentMonth)),
    [days, currentMonth]
  );

  // Calculer les IDs des AM (mémoïsé)
  const amIds = useMemo(() => {
    const configIds = team.map((t) => t.id);
    const dataIds = new Set<number>();
    monthDays.forEach((d) => d.am.forEach((s) => dataIds.add(s.am_id)));

    return Array.from(new Set([...configIds, ...Array.from(dataIds)])).sort(
      (a, b) => a - b
    );
  }, [team, monthDays]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, date: string, amId: number) => {
      setDraggedData({ date, amId });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify({ date, amId }));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, date: string, amId: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (
        draggedData &&
        draggedData.date === date &&
        draggedData.amId !== amId
      ) {
        setDragOverTarget({ date, amId });
      }
    },
    [draggedData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, date: string, targetAmId: number) => {
      e.preventDefault();

      if (
        draggedData &&
        draggedData.date === date &&
        draggedData.amId !== targetAmId
      ) {
        onSwap(date, draggedData.amId, targetAmId);
      }

      setDraggedData(null);
      setDragOverTarget(null);
    },
    [draggedData, onSwap]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  // Map pour lookup rapide des profils AM (mémoïsé)
  const teamMap = useMemo(() => {
    const map = new Map<number, AssistantProfile>();
    team.forEach((t) => map.set(t.id, t));
    return map;
  }, [team]);

  // Helpers affichage (utilisent le map mémoïsé)
  const getAmName = useCallback(
    (id: number) => teamMap.get(id)?.name || `AM ${id + 1}`,
    [teamMap]
  );
  const getAmColor = useCallback(
    (id: number) => teamMap.get(id)?.color || "#e9ecef",
    [teamMap]
  );

  // Totaux (mémoïsé)
  const amTotals = useMemo(() => {
    return amIds.map((amId) => {
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
  }, [amIds, monthDays]);

  // Afficher un empty state si aucun jour ce mois
  if (monthDays.length === 0) {
    return (
      <EmptyState
        icon={<LuCalendar size={32} />}
        title="Aucun planning pour ce mois"
        description="Importez un fichier PDF ou utilisez le formulaire d'ajout rapide ci-dessus pour ajouter un enfant."
      />
    );
  }

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
            const hasContent = hasShifts || day.enfants.length > 0;

            return (
              <React.Fragment key={day.date}>
                {/* Ligne principale */}
                <tr className={`day-row ${isExpanded ? "expanded" : ""}`}>
                  <td
                    className="date-cell sticky-col"
                    onClick={() => onDayClick(day)}
                  >
                    <div className="date-content">
                      {hasDaySurcharge(day.enfants, day.am, day.ratio || 4) && (
                        <span
                          className="overload-badge"
                          title="Manque d'AM sur ce créneau"
                        >
                          ⚠️
                        </span>
                      )}
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
                        onDragLeave={handleDragLeave}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasContent) {
                            toggleExpand(day.date);
                          }
                        }}
                      >
                        {hasShift && (
                          <div className="shift-pills-container">
                            {shift.heures
                              .slice()
                              .sort((a, b) => a.arrivee - b.arrivee)
                              .map((h, i) => (
                                <div
                                  key={i}
                                  className="shift-pill"
                                  title={`${minutesToTime(h.arrivee)} - ${minutesToTime(h.depart)}`}
                                >
                                  {minutesToTime(h.arrivee)}-
                                  {minutesToTime(h.depart)}
                                </div>
                              ))}
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
