import {
  LuCalendarDays,
  LuDownload,
  LuFileUp,
  LuUsers,
  LuFileSpreadsheet,
  LuFileText,
  LuChevronDown,
} from "react-icons/lu";
import "./Header.css";
import React from "react";
import { SettingsModal } from "./Planning/SettingsModal.tsx";
import { Modal } from "./ui/Modal.tsx";

interface HeaderProps {
  setIsTeamModalOpen: (isOpen: boolean) => void;
  handleImportPdf: (
    year: number,
    ratio: number,
    active_team_ids: number[]
  ) => void;
  handleExportPdf: () => void;
  handleExportExcel: () => void;
}

const Header: React.FC<HeaderProps> = ({
  setIsTeamModalOpen,
  handleImportPdf,
  handleExportPdf,
  handleExportExcel,
}) => {
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">
          <LuCalendarDays size={24} />
        </div>
        <div>
          <h1>MAM Plannings</h1>
        </div>
      </div>
      <nav className="header-actions" aria-label="Actions principales">
        <button
          onClick={() => setIsTeamModalOpen(true)}
          className="btn-secondary"
          aria-label="Gérer l'équipe"
        >
          <LuUsers size={18} aria-hidden="true" /> Équipe
        </button>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="btn-primary"
          aria-label="Importer un planning PDF"
        >
          <LuFileUp size={18} aria-hidden="true" /> Importer
        </button>

        {/* Menu déroulant d'export */}
        <div className="export-dropdown">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="btn-primary"
            aria-expanded={exportMenuOpen}
            aria-haspopup="menu"
            aria-label="Menu d'export"
          >
            <LuDownload size={18} aria-hidden="true" /> Exporter{" "}
            <LuChevronDown size={14} aria-hidden="true" />
          </button>
          {exportMenuOpen && (
            <div
              className="export-menu"
              role="menu"
              aria-label="Options d'export"
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              <button
                role="menuitem"
                onClick={() => {
                  handleExportPdf();
                  setExportMenuOpen(false);
                }}
              >
                <LuFileText size={16} aria-hidden="true" /> PDF (lecture seule)
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  handleExportExcel();
                  setExportMenuOpen(false);
                }}
              >
                <LuFileSpreadsheet size={16} aria-hidden="true" /> Excel
                (modifiable)
              </button>
            </div>
          )}
        </div>
      </nav>

      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Importer un planning PDF"
      >
        <SettingsModal
          onSave={(year, ratio, team) => handleImportPdf(year, ratio, team)}
          onClose={() => setSettingsModalOpen(false)}
        />
      </Modal>
    </header>
  );
};

export default Header;
