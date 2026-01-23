import { useState, useEffect } from "react";
import { usePlanning } from "./hooks/usePlanning";
import { MonthlyTable } from "./components/Planning/MonthlyTable";
import { MonthNavigation } from "./components/MonthNavigation";
import { DayTable } from "./components/Planning/DayTable";
import { AddEntryForm } from "./components/Planning/AddEntryForm";
import { Modal } from "./components/ui/Modal";
import { Day } from "./types";
import "./App.css";
import { TeamManager } from "./components/Team/TeamManager.tsx";
import { LoadingOverlay } from "./components/ui/LoadingOverlay.tsx";
import {
  generateMonthlyPdf,
  generateMonthlyExcel,
} from "./utils/pdfExporter.ts";
import { useTeam } from "./hooks/useTeam.ts";
import Header from "./components/Header.tsx";

/**
 * Composant principal de l'application MAM Plannings.
 * Gère l'état global et la logique principale.
 */
function App() {
  const {
    days,
    loading,
    handleImportPdf,
    handleDeleteChild,
    handleAddEntry,
    handleRemoveDay,
    handleSwap,
    handleUpdateShift,
    handleUpdateRatio,
  } = usePlanning();

  const {
    team,
    handleAddTeammate,
    handleUpdateTeammate,
    handleRemoveTeammate,
  } = useTeam();

  // Etat pour la navigation et la sélection
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Day | null>(null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Synchroniser selectedDay avec days quand days change
  useEffect(() => {
    if (selectedDay) {
      const updatedDay = days.find((d) => d.date === selectedDay.date);
      if (updatedDay) {
        setSelectedDay(updatedDay);
      }
    }
  }, [days, selectedDay]);

  // Fonction pour gérer l'export PDF
  const handleExportPdf = () => {
    void generateMonthlyPdf(days, team, currentMonth);
  };

  // Fonction pour gérer l'export Excel
  const handleExportExcel = () => {
    void generateMonthlyExcel(days, team, currentMonth);
  };

  return (
    <div className="container">
      {/* Overlay de chargement */}
      <LoadingOverlay
        isLoading={loading}
        message="Analyse du PDF en cours..."
      />

      {/* HEADER */}
      <Header
        setIsTeamModalOpen={setIsTeamModalOpen}
        handleImportPdf={handleImportPdf}
        handleExportPdf={handleExportPdf}
        handleExportExcel={handleExportExcel}
      />

      {/* NAVIGATION MOIS ( < Novembre > ) */}
      <MonthNavigation currentDate={currentMonth} onChange={setCurrentMonth} />

      {/* FORMULAIRE AJOUT RAPIDE */}
      <AddEntryForm
        onAdd={(date, name, start, end) => {
          void handleAddEntry(date, name, start, end);
          // Naviguer vers le mois de la date ajoutée
          const addedDate = new Date(date);
          if (!isNaN(addedDate.getTime())) {
            setCurrentMonth(addedDate);
          }
        }}
      />

      {/* TABLEAU MENSUEL */}
      <main className="planning-board">
        {loading ? (
          <p className="loading-text">Chargement du planning...</p>
        ) : (
          <MonthlyTable
            days={days}
            team={team}
            currentMonth={currentMonth}
            onDayClick={(day) => setSelectedDay(day)}
            onSwap={handleSwap}
            onShiftChange={handleUpdateShift}
          />
        )}
      </main>

      {/* MODALE GESTION ÉQUIPE */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Gestion de l'équipe"
      >
        <TeamManager
          team={team}
          onAdd={handleAddTeammate}
          onUpdate={handleUpdateTeammate}
          onDelete={handleRemoveTeammate}
        />
      </Modal>

      {/* MODALE DETAILS */}
      <Modal
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `Détails du ${selectedDay.jour}` : ""}
      >
        {selectedDay && (
          <DayTable
            day={selectedDay}
            onDeleteChild={(d, n) => {
              void handleDeleteChild(d, n);
            }}
            onDeleteDay={() => {
              void handleRemoveDay(selectedDay.date);
              setSelectedDay(null);
            }}
            onUpdateRatio={(ratio) => {
              void handleUpdateRatio(selectedDay.date, ratio);
            }}
            onAddChild={(name, start, end) => {
              void handleAddEntry(selectedDay.date, name, start, end);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default App;
