import React, {
  useRef,
  useState,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Tooltip,
} from "recharts";
import {
  AssistantProfile,
  AssistantShift,
  Child,
  TimeRange,
} from "../../types";
import { minutesToTime } from "../../utils/formatters";
import { LuX, LuGripVertical } from "react-icons/lu";
import "./TimelineEditor.css";

// Contexte pour le drag inter-AM
interface CrossDragData {
  range: TimeRange;
  sourceAmId: number;
  rangeIndex: number;
}

interface CrossDragContextType {
  draggedData: CrossDragData | null;
  setDraggedData: (data: CrossDragData | null) => void;
}

const CrossDragContext = createContext<CrossDragContextType | null>(null);

interface Props {
  enfants: Child[];
  shifts: AssistantShift[];
  team: AssistantProfile[];
  ratio: number; // Ratio enfants par AM (ex: 4)
  onShiftChange: (amId: number, newRanges: TimeRange[]) => void;
}

// Constantes pour la timeline
const DAY_START = 7 * 60; // 7h00 en minutes
const DAY_END = 20 * 60; // 20h00 en minutes
const TOTAL_MINUTES = DAY_END - DAY_START;

interface PresenceDataPoint {
  time: number;
  enfants: number;
  ams: number;
  capacite: number; // nb AM * ratio = capacité max d'enfants
  surcharge: number; // enfants au-dessus de la capacité (pour zone rouge)
  sousCharge: number; // capacité non utilisée (pour zone verte)
  arrivees: string[]; // noms des enfants qui arrivent à ce moment
  departs: string[]; // noms des enfants qui partent à ce moment
}

/**
 * Calcule le nombre d'enfants et d'AM présents pour chaque tranche horaire
 */
const calculatePresenceData = (
  enfants: Child[],
  shifts: AssistantShift[],
  ratio: number
): PresenceDataPoint[] => {
  const enfantsPresence: number[] = new Array(TOTAL_MINUTES).fill(0);
  const amsPresence: number[] = new Array(TOTAL_MINUTES).fill(0);

  // Maps pour les arrivées et départs (clé = minute, valeur = liste de noms)
  const arriveesMap: Map<number, string[]> = new Map();
  const departsMap: Map<number, string[]> = new Map();

  // Compter les enfants par minute et collecter arrivées/départs
  enfants.forEach((child) => {
    child.heures.forEach((range) => {
      const start = Math.max(range.arrivee - DAY_START, 0);
      const end = Math.min(range.depart - DAY_START, TOTAL_MINUTES);
      for (let i = start; i < end; i++) {
        enfantsPresence[i]++;
      }

      // Enregistrer l'arrivée (arrondie aux 5 minutes)
      const arriveeRound = Math.round(start / 5) * 5;
      if (!arriveesMap.has(arriveeRound)) arriveesMap.set(arriveeRound, []);
      arriveesMap.get(arriveeRound)!.push(child.nom);

      // Enregistrer le départ (arrondi aux 5 minutes)
      const departRound = Math.round(end / 5) * 5;
      if (!departsMap.has(departRound)) departsMap.set(departRound, []);
      departsMap.get(departRound)!.push(child.nom);
    });
  });

  // Compter les AM par minute
  shifts.forEach((shift) => {
    shift.heures.forEach((range) => {
      const start = Math.max(range.arrivee - DAY_START, 0);
      const end = Math.min(range.depart - DAY_START, TOTAL_MINUTES);
      for (let i = start; i < end; i++) {
        amsPresence[i]++;
      }
    });
  });

  // Échantillonnage tous les 5 minutes
  const data: PresenceDataPoint[] = [];
  for (let i = 0; i <= TOTAL_MINUTES; i += 5) {
    const nbEnfants = enfantsPresence[Math.min(i, TOTAL_MINUTES - 1)] || 0;
    const nbAms = amsPresence[Math.min(i, TOTAL_MINUTES - 1)] || 0;
    const capacite = nbAms * ratio;

    data.push({
      time: DAY_START + i,
      enfants: nbEnfants,
      ams: nbAms,
      capacite: capacite,
      surcharge: Math.max(0, nbEnfants - capacite), // Excès d'enfants
      sousCharge: Math.max(0, capacite - nbEnfants), // Capacité inutilisée
      arrivees: arriveesMap.get(i) || [],
      departs: departsMap.get(i) || [],
    });
  }

  return data;
};

/**
 * Trouve les zones de surcharge (trop d'enfants par rapport aux AM)
 */
const findOverloadZones = (
  data: PresenceDataPoint[]
): { start: number; end: number }[] => {
  const zones: { start: number; end: number }[] = [];
  let zoneStart: number | null = null;

  data.forEach((point, idx) => {
    const isOverloaded = point.enfants > point.capacite && point.capacite > 0;

    if (isOverloaded && zoneStart === null) {
      zoneStart = point.time;
    } else if (!isOverloaded && zoneStart !== null) {
      zones.push({ start: zoneStart, end: data[idx - 1]?.time || point.time });
      zoneStart = null;
    }
  });

  // Fermer la dernière zone si elle est encore ouverte
  if (zoneStart !== null) {
    zones.push({ start: zoneStart, end: data[data.length - 1].time });
  }

  return zones;
};

/**
 * Tooltip personnalisé pour le graphique de présence
 */
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PresenceDataPoint }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as PresenceDataPoint;
  const hasArrivees = data.arrivees.length > 0;
  const hasDeparts = data.departs.length > 0;

  return (
    <div className="presence-tooltip">
      <div className="tooltip-time">{minutesToTime(data.time)}</div>
      <div className="tooltip-stats">
        <span className="tooltip-enfants">
          {data.enfants} enfant{data.enfants > 1 ? "s" : ""}
        </span>
        <span className="tooltip-ams">{data.ams} AM</span>
      </div>
      {hasArrivees && (
        <div className="tooltip-arrivees">
          <span className="tooltip-icon">→</span>
          <span>{data.arrivees.join(", ")}</span>
        </div>
      )}
      {hasDeparts && (
        <div className="tooltip-departs">
          <span className="tooltip-icon">←</span>
          <span>{data.departs.join(", ")}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Fusionne les plages horaires qui se chevauchent ou se touchent
 */
const mergeOverlappingRanges = (ranges: TimeRange[]): TimeRange[] => {
  if (ranges.length <= 1) return ranges;

  // Trier par heure de début
  const sorted = [...ranges].sort((a, b) => a.arrivee - b.arrivee);
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Si les plages se chevauchent ou se touchent, fusionner
    if (current.arrivee <= last.depart) {
      last.depart = Math.max(last.depart, current.depart);
    } else {
      merged.push(current);
    }
  }

  return merged;
};

/**
 * Composant pour afficher et éditer une timeline d'un shift AM
 */
interface ShiftTimelineProps {
  shift: AssistantShift;
  profile: AssistantProfile | undefined;
  onRangeChange: (newRanges: TimeRange[]) => void;
  onCrossTransfer: (
    sourceAmId: number,
    sourceRangeIndex: number,
    range: TimeRange
  ) => void;
  containerWidth: number;
}

const ShiftTimeline: React.FC<ShiftTimelineProps> = ({
  shift,
  profile,
  onRangeChange,
  onCrossTransfer,
  containerWidth,
}) => {
  const crossDragCtx = useContext(CrossDragContext);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragState, setDragState] = useState<{
    rangeIndex: number;
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    originalRange: TimeRange;
  } | null>(null);

  const minutesToPixels = useCallback(
    (minutes: number) =>
      ((minutes - DAY_START) / TOTAL_MINUTES) * containerWidth,
    [containerWidth]
  );

  const handleMouseDown = (
    e: React.MouseEvent,
    rangeIndex: number,
    type: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      rangeIndex,
      type,
      startX: e.clientX,
      originalRange: { ...shift.heures[rangeIndex] },
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaMinutes = Math.round(
        (deltaX / containerWidth) * TOTAL_MINUTES
      );

      const newRanges = [...shift.heures];
      const range = { ...dragState.originalRange };

      // Arrondir aux 5 minutes
      const roundTo5 = (val: number) => Math.round(val / 5) * 5;

      if (dragState.type === "move") {
        const duration = range.depart - range.arrivee;
        let newStart = roundTo5(range.arrivee + deltaMinutes);
        newStart = Math.max(DAY_START, Math.min(DAY_END - duration, newStart));
        range.arrivee = newStart;
        range.depart = newStart + duration;
      } else if (dragState.type === "resize-left") {
        let newStart = roundTo5(range.arrivee + deltaMinutes);
        newStart = Math.max(DAY_START, Math.min(range.depart - 30, newStart)); // Min 30 min
        range.arrivee = newStart;
      } else if (dragState.type === "resize-right") {
        let newEnd = roundTo5(range.depart + deltaMinutes);
        newEnd = Math.max(range.arrivee + 30, Math.min(DAY_END, newEnd)); // Min 30 min
        range.depart = newEnd;
      }

      newRanges[dragState.rangeIndex] = range;
      onRangeChange(newRanges);
    },
    [dragState, containerWidth, shift.heures, onRangeChange]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState) {
      // Fusionner les plages qui se chevauchent après le drag
      const merged = mergeOverlappingRanges(shift.heures);
      if (merged.length !== shift.heures.length) {
        onRangeChange(merged);
      }
    }
    setDragState(null);
  }, [dragState, shift.heures, onRangeChange]);

  // Gérer le clic sur la track pour ajouter une nouvelle plage
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Ne pas ajouter si on clique sur un bloc existant
      if ((e.target as HTMLElement).closest(".shift-block")) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickMinutes =
        Math.round((clickX / containerWidth) * TOTAL_MINUTES) + DAY_START;

      // Arrondir aux 15 minutes
      const roundTo15 = (val: number) => Math.round(val / 15) * 15;
      const startTime = roundTo15(clickMinutes - 30); // 30 min avant le clic
      const endTime = roundTo15(clickMinutes + 30); // 30 min après le clic

      // Limiter aux bornes de la journée
      const newRange: TimeRange = {
        arrivee: Math.max(DAY_START, startTime),
        depart: Math.min(DAY_END, endTime),
      };

      // Ajouter et fusionner si nécessaire
      const newRanges = mergeOverlappingRanges([...shift.heures, newRange]);
      onRangeChange(newRanges);
    },
    [containerWidth, shift.heures, onRangeChange]
  );

  // Supprimer une plage horaire
  const handleDeleteRange = useCallback(
    (e: React.MouseEvent, rangeIndex: number) => {
      e.stopPropagation(); // Empêcher le clic de se propager à la track
      const newRanges = shift.heures.filter((_, idx) => idx !== rangeIndex);
      onRangeChange(newRanges);
    },
    [shift.heures, onRangeChange]
  );

  // --- Drag inter-AM ---
  const handleCrossDragStart = useCallback(
    (e: React.DragEvent, rangeIndex: number) => {
      if (!crossDragCtx) return;
      const range = shift.heures[rangeIndex];
      crossDragCtx.setDraggedData({
        range: { ...range },
        sourceAmId: shift.am_id,
        rangeIndex,
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(range));
    },
    [crossDragCtx, shift.heures, shift.am_id]
  );

  // Empêcher le mousedown sur la poignée de transfert de déclencher le drag de déplacement
  const handleTransferMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleCrossDragEnd = useCallback(() => {
    if (!crossDragCtx) return;
    crossDragCtx.setDraggedData(null);
    setIsDragOver(false);
  }, [crossDragCtx]);

  const handleTrackDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Ne pas montrer le feedback si on est sur la même timeline source
      if (crossDragCtx?.draggedData?.sourceAmId === shift.am_id) {
        setIsDragOver(false);
        return;
      }

      if (crossDragCtx?.draggedData) {
        setIsDragOver(true);
      }
    },
    [crossDragCtx, shift.am_id]
  );

  const handleTrackDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleTrackDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      if (!crossDragCtx?.draggedData) return;

      const { range, sourceAmId, rangeIndex } = crossDragCtx.draggedData;

      // Ne pas accepter le drop sur la même timeline
      if (sourceAmId === shift.am_id) return;

      // Transférer la plage vers cette timeline
      onCrossTransfer(sourceAmId, rangeIndex, range);

      crossDragCtx.setDraggedData(null);
    },
    [crossDragCtx, shift.am_id, onCrossTransfer]
  );

  // Attacher/détacher les événements globaux
  React.useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const color = profile?.color || "#9CA3AF";
  const name = profile?.name || `AM ${shift.am_id + 1}`;
  const isEmpty = shift.heures.length === 0;

  return (
    <div className={`shift-timeline-row ${isEmpty ? "empty" : ""}`}>
      <div className="shift-timeline-label" style={{ borderLeftColor: color }}>
        {name}
      </div>
      <div
        className={`shift-timeline-track ${isDragOver ? "drag-over" : ""}`}
        onClick={handleTrackClick}
        onDragOver={handleTrackDragOver}
        onDragLeave={handleTrackDragLeave}
        onDrop={handleTrackDrop}
      >
        {isEmpty && (
          <span className="empty-hint">Cliquer pour ajouter un horaire</span>
        )}
        {shift.heures.map((range, idx) => {
          const left = minutesToPixels(range.arrivee);
          const width = minutesToPixels(range.depart) - left;
          const isNarrow = width < 80; // Plage trop étroite pour afficher le texte
          const timeLabel = `${minutesToTime(range.arrivee)} - ${minutesToTime(range.depart)}`;
          const isCrossDragging =
            crossDragCtx?.draggedData?.sourceAmId === shift.am_id &&
            crossDragCtx?.draggedData?.rangeIndex === idx;

          return (
            <div
              key={idx}
              className={`shift-block ${dragState?.rangeIndex === idx ? "dragging" : ""} ${isNarrow ? "narrow" : ""} ${isCrossDragging ? "cross-dragging" : ""}`}
              style={{
                left: `${left}px`,
                width: `${width}px`,
                backgroundColor: color,
              }}
              title={timeLabel}
            >
              {/* Poignée gauche */}
              <div
                className="resize-handle resize-left"
                onMouseDown={(e) => handleMouseDown(e, idx, "resize-left")}
              />
              {/* Zone centrale - déplacement */}
              <div
                className="shift-block-content"
                onMouseDown={(e) => handleMouseDown(e, idx, "move")}
              >
                {!isNarrow && (
                  <>
                    {/* Poignée de transfert inter-AM (au centre) */}
                    <div
                      className="transfer-handle"
                      draggable
                      onMouseDown={handleTransferMouseDown}
                      onDragStart={(e) => handleCrossDragStart(e, idx)}
                      onDragEnd={handleCrossDragEnd}
                      title="Glisser vers une autre AM"
                    >
                      <LuGripVertical size={14} />
                    </div>
                    <span className="shift-time-label">{timeLabel}</span>
                  </>
                )}
                {isNarrow && (
                  /* Poignée de transfert pour blocs étroits */
                  <div
                    className="transfer-handle"
                    draggable
                    onMouseDown={handleTransferMouseDown}
                    onDragStart={(e) => handleCrossDragStart(e, idx)}
                    onDragEnd={handleCrossDragEnd}
                    title="Glisser vers une autre AM"
                  >
                    <LuGripVertical size={14} />
                  </div>
                )}
              </div>
              {/* Bouton de suppression */}
              <button
                className="delete-range-btn"
                onClick={(e) => handleDeleteRange(e, idx)}
                title="Supprimer cette plage"
              >
                <LuX size={12} />
              </button>
              {/* Poignée droite */}
              <div
                className="resize-handle resize-right"
                onMouseDown={(e) => handleMouseDown(e, idx, "resize-right")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Composant principal d'édition de timeline
 */
export const TimelineEditor: React.FC<Props> = ({
  enfants,
  shifts,
  team,
  ratio,
  onShiftChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // État pour le drag inter-AM
  const [crossDraggedData, setCrossDraggedData] =
    useState<CrossDragData | null>(null);

  // Callback pour transférer une plage d'un AM vers un autre
  const handleCrossTransfer = useCallback(
    (
      targetAmId: number,
      sourceAmId: number,
      sourceRangeIndex: number,
      range: TimeRange
    ) => {
      // 1. Retirer la plage de l'AM source
      const sourceShift = shifts.find((s) => s.am_id === sourceAmId);
      if (sourceShift) {
        const newSourceRanges = sourceShift.heures.filter(
          (_, idx) => idx !== sourceRangeIndex
        );
        onShiftChange(sourceAmId, newSourceRanges);
      }

      // 2. Ajouter la plage à l'AM destination (avec fusion si chevauchement)
      const targetShift = shifts.find((s) => s.am_id === targetAmId);
      const existingRanges = targetShift?.heures || [];
      const newTargetRanges = mergeOverlappingRanges([
        ...existingRanges,
        range,
      ]);
      onShiftChange(targetAmId, newTargetRanges);
    },
    [shifts, onShiftChange]
  );

  // Calculer les données de présence
  const presenceData = useMemo(
    () => calculatePresenceData(enfants, shifts, ratio),
    [enfants, shifts, ratio]
  );

  // Trouver les zones de surcharge
  const overloadZones = useMemo(
    () => findOverloadZones(presenceData),
    [presenceData]
  );

  // Calculer le max pour l'axe Y
  const maxY = useMemo(() => {
    const maxEnfants = Math.max(...presenceData.map((d) => d.enfants), 1);
    const maxCapacite = Math.max(...presenceData.map((d) => d.capacite), ratio);
    return Math.max(maxEnfants, maxCapacite) + 1;
  }, [presenceData, ratio]);

  // Générer les ticks Y basés sur le ratio
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= maxY; i += ratio) {
      ticks.push(i);
    }
    // S'assurer qu'on a au moins le ratio affiché
    if (!ticks.includes(ratio)) ticks.push(ratio);
    return ticks.sort((a, b) => a - b);
  }, [maxY, ratio]);

  // Observer la taille du conteneur
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Largeur de la zone de timeline (sans le label)
        const labelWidth = 100; // Correspond à .shift-timeline-label width
        setContainerWidth(containerRef.current.offsetWidth - labelWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return (
    <CrossDragContext.Provider
      value={{
        draggedData: crossDraggedData,
        setDraggedData: setCrossDraggedData,
      }}
    >
      <div className="timeline-editor" ref={containerRef}>
        {/* Graphique de présence enfants avec capacité */}
        <div className="presence-chart">
          <div className="chart-label">
            <span className="chart-label-title">Enfants</span>
            <span className="chart-label-ratio">ratio: {ratio}</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={presenceData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  {/* Gradient pour les enfants */}
                  <linearGradient id="colorEnfants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.2} />
                  </linearGradient>
                  {/* Gradient pour la surcharge (rouge) */}
                  <linearGradient
                    id="colorSurcharge"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.3} />
                  </linearGradient>
                </defs>

                {/* Axe X avec les heures */}
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={[DAY_START, DAY_END]}
                  ticks={Array.from(
                    { length: 14 },
                    (_, i) => DAY_START + i * 60
                  )}
                  tickFormatter={(value) => `${Math.floor(value / 60)}h`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  height={20}
                />

                {/* Axe Y avec divisions par ratio */}
                <YAxis
                  domain={[0, maxY]}
                  ticks={yTicks}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#6B7280" }}
                  width={30}
                />

                {/* Tooltip personnalisé */}
                <Tooltip content={<CustomTooltip />} />

                {/* Ligne de référence pour chaque palier de ratio */}
                {yTicks.map((tick) => (
                  <ReferenceLine
                    key={tick}
                    y={tick}
                    stroke={tick > 0 ? "#E5E7EB" : "transparent"}
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Zones de surcharge en fond rouge */}
                {overloadZones.map((zone, idx) => (
                  <ReferenceArea
                    key={idx}
                    x1={zone.start}
                    x2={zone.end}
                    fill="#FEE2E2"
                    fillOpacity={0.5}
                  />
                ))}

                {/* Ligne de capacité (nb AM * ratio) */}
                <Area
                  type="stepAfter"
                  dataKey="capacite"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  fill="none"
                  isAnimationActive={false}
                />

                {/* Aire des enfants */}
                <Area
                  type="stepAfter"
                  dataKey="enfants"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#colorEnfants)"
                  isAnimationActive={false}
                />

                {/* Surcharge (partie qui dépasse) */}
                <Area
                  type="stepAfter"
                  dataKey="surcharge"
                  stroke="#EF4444"
                  strokeWidth={0}
                  fill="url(#colorSurcharge)"
                  isAnimationActive={false}
                  baseValue={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Légende */}
        <div className="chart-legend">
          <div className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: "#6366F1" }}
            />
            <span>Enfants présents</span>
          </div>
          <div className="legend-item">
            <span className="legend-line" style={{ borderColor: "#10B981" }} />
            <span>Capacité (AM × {ratio})</span>
          </div>
          <div className="legend-item legend-warning">
            <span
              className="legend-color"
              style={{ backgroundColor: "#EF4444" }}
            />
            <span>Surcharge</span>
          </div>
        </div>

        {/* Timelines des AM */}
        <div className="shifts-container">
          {team.map((profile) => {
            // Trouver le shift existant pour cet AM, ou créer un shift vide
            const existingShift = shifts.find((s) => s.am_id === profile.id);
            const shift: AssistantShift = existingShift || {
              am_id: profile.id,
              heures: [],
            };

            return (
              <ShiftTimeline
                key={profile.id}
                shift={shift}
                profile={profile}
                onRangeChange={(newRanges) =>
                  onShiftChange(profile.id, newRanges)
                }
                onCrossTransfer={(sourceAmId, sourceRangeIndex, range) =>
                  handleCrossTransfer(
                    profile.id,
                    sourceAmId,
                    sourceRangeIndex,
                    range
                  )
                }
                containerWidth={containerWidth}
              />
            );
          })}
        </div>
      </div>
    </CrossDragContext.Provider>
  );
};
