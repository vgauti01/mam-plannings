import { useState, useEffect } from "react";
import { AssistantProfile, MonthSettings } from "../../types";
import { planningService } from "../../services/planningService";
import "./MonthSettingsModal.css"; // CSS à créer ci-dessous

interface Props {
    currentSettings: MonthSettings;
    onSave: (ratio: number, team: AssistantProfile[]) => void;
    onClose: () => void;
}

export const MonthSettingsModal = ({ currentSettings, onSave, onClose }: Props) => {
    const [ratio, setRatio] = useState(currentSettings.ratio);

    // Liste des IDs sélectionnés pour ce mois
    const [selectedIds, setSelectedIds] = useState<number[]>(
        currentSettings.active_team.map(t => t.id)
    );

    // Annuaire complet (chargé au montage)
    const [library, setLibrary] = useState<AssistantProfile[]>([]);

    useEffect(() => {
        // On charge tout l'annuaire pour proposer les choix
        planningService.getTeamLibrary().then(setLibrary);
    }, []);

    const toggleId = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSave = () => {
        // On reconstruit la liste des objets AssistantProfile à partir des IDs
        const activeTeam = library.filter(am => selectedIds.includes(am.id));
        onSave(ratio, activeTeam);
        onClose();
    };

    return (
        <div className="settings-container">
            {/* SECTION 1 : RATIO */}
            <div className="setting-group">
                <label className="setting-label">Ratio Enfants / AM</label>
                <div className="ratio-control">
                    <input
                        type="number"
                        min="1" max="8"
                        value={ratio}
                        onChange={e => setRatio(Number(e.target.value))}
                    />
                </div>
            </div>

            <hr className="divider"/>

            {/* SECTION 2 : ÉQUIPE */}
            <div className="setting-group">
                <label className="setting-label">Effectifs du mois</label>
                <p className="hint">Cochez les personnes présentes sur le planning ce mois-ci.</p>

                <div className="library-grid">
                    {library.map(am => {
                        const isSelected = selectedIds.includes(am.id);
                        return (
                            <div
                                key={am.id}
                                className={`am-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleId(am.id)}
                                style={{borderLeftColor: am.color}}
                            >
                                <div className="checkbox-visual">
                                    {isSelected && "✔"}
                                </div>
                                <span>{am.name}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>Annuler</button>
                <button className="btn-primary" onClick={handleSave}>
                    Enregistrer & Recalculer
                </button>
            </div>
        </div>
    );
};