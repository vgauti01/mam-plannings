import { useState } from "react";
import { usePlanning } from "./hooks/usePlanning";
import { MonthlyTable } from "./components/Planning/MonthlyTable";
import { MonthNavigation } from "./components/MonthNavigation";
import { AddEntryForm } from "./components/Planning/AddEntryForm";
import { DayTable } from "./components/Planning/DayTable"; // On réutilise ton ancien composant !
import { Modal } from "./components/ui/Modal";
import { Day } from "./types";
import "./App.css";
import { TeamManager } from "./components/Team/TeamManager.tsx";
import { LoadingOverlay } from "./components/ui/LoadingOverlay.tsx";
import {
  LuCalendarRange,
  LuDownload,
  LuFileInput,
  LuUsers,
} from "react-icons/lu";
import { generateMonthlyPdf } from "./utils/pdfExporter.ts";
import { useTeam } from "./hooks/useTeam.ts";

/**
 * Composant principal de l'application MAM Plannings.
 * Gère l'état global et la logique principale.
 */
function App() {
  const {
    days,
    loading,
    error,
    handleImportPdf,
    handleDeleteChild,
    handleAddEntry,
    handleRemoveDay,
    handleSwap,
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

  // Fonction pour gérer l'export PDF
  const handleExportPdf = () => {
    void generateMonthlyPdf(days, team, currentMonth);
  };

  return (
    <div className="container">
      {/* Overlay de chargement */}
      <LoadingOverlay
        isLoading={loading}
        message="Analyse du PDF en cours..."
      />

      {/* HEADER */}
      <header className="app-header">
        <div className="header-left">
          <LuCalendarRange size={30} />
          <h1>MAM Plannings</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="btn-secondary"
          >
            <LuUsers /> Équipe
          </button>
          <button onClick={handleImportPdf} className="btn-primary">
            <LuFileInput /> Importer PDF
          </button>
          <button onClick={handleExportPdf} className="btn-primary">
            <LuDownload /> Exporter PDF
          </button>
        </div>
      </header>

      {/* BANNIERE D'ERREUR */}
      {error && <div className="error-banner">{error}</div>}

      {/* NAVIGATION MOIS ( < Novembre > ) */}
      <MonthNavigation currentDate={currentMonth} onChange={setCurrentMonth} />

      {/* FORMULAIRE AJOUT ENTRÉE */}
      <AddEntryForm onAdd={handleAddEntry} />

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
          />
        )}
      </Modal>
    </div>
  );
}

export default App;
