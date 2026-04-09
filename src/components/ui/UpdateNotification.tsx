import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import "./UpdateNotification.css";

export function UpdateNotification() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check()
      .then((u) => setUpdate(u))
      .catch(() => {
        // Silencieux si pas de connexion ou endpoint non configuré
      });
  }, []);

  if (!update || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    await update.downloadAndInstall();
    await relaunch();
  };

  return (
    <div role="alert" className="update-notification">
      <span className="update-notification__message">
        Mise à jour <strong>{update.version}</strong> disponible
      </span>
      <button
        onClick={() => void handleInstall()}
        disabled={installing}
        className="update-notification__install-btn"
      >
        {installing ? "Installation…" : "Installer"}
      </button>
      {!installing && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Ignorer"
          className="update-notification__dismiss-btn"
        >
          ×
        </button>
      )}
    </div>
  );
}
