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
      <div className="header-actions">
        <button
          onClick={() => setIsTeamModalOpen(true)}
          className="btn-secondary"
        >
          <LuUsers size={18} /> Équipe
        </button>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="btn-primary"
        >
          <LuFileUp size={18} /> Importer
        </button>

        {/* Menu déroulant d'export */}
        <div className="export-dropdown">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="btn-primary"
          >
            <LuDownload size={18} /> Exporter <LuChevronDown size={14} />
          </button>
          {exportMenuOpen && (
            <div
              className="export-menu"
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              <button
                onClick={() => {
                  handleExportPdf();
                  setExportMenuOpen(false);
                }}
              >
                <LuFileText size={16} /> PDF (lecture seule)
              </button>
              <button
                onClick={() => {
                  handleExportExcel();
                  setExportMenuOpen(false);
                }}
              >
                <LuFileSpreadsheet size={16} /> Excel (modifiable)
              </button>
            </div>
          )}
        </div>
      </div>

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
