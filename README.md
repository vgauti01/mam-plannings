# 📅 MAM Plannings

**MAM Plannings** est une application de bureau moderne conçue pour simplifier la gestion des plannings dans les **MAM (Maisons d'Assistants Maternels)**.

Elle permet d'importer les horaires des enfants (via PDF ou saisie manuelle), calcule automatiquement les besoins en personnel (ratio 1 AM pour 4 enfants), et génère un planning d'équipe optimisé et exportable.

## ✨ Fonctionnalités

* **📥 Import Intelligent** : Analyse automatique des fichiers PDF de planning (parsing des horaires d'arrivée/départ des enfants).
* **🧮 Algorithme d'Optimisation** : Calcul automatique des horaires des AMs nécessaires selon le taux d'encadrement légal.
* **👥 Gestion d'Équipe** : Ajout, modification et suppression des Assistants Maternels avec code couleur personnalisé.
* **🗓️ Vue Mensuelle Interactive** :
    * Visualisation claire des horaires par AM.
    * **Drag & Drop** : Échangez les horaires entre deux AMs par simple glisser-déposer.
    * Affichage des totaux d'heures mensuels.
* **💾 Persistance des Données** : Sauvegarde automatique locale (JSON) sécurisée.
* **🖨️ Export PDF** : Génération de tableaux de service propres et lisibles pour l'impression.
* **🛠️ Outils** : Overlay de chargement, gestion des erreurs, navigation intuitive.

## 🛠️ Stack Technique

Le projet suit une architecture rigoureuse séparant le Frontend (UI) du Backend (Logique métier & Système).

### Backend (Rust 🦀)

* **Framework** : [Tauri v2](https://tauri.app/)
* **Parsing** : `pdf-extract`, `regex`
* **Algorithme** : Logique custom de segmentation temporelle et d'attribution des shifts.
* **État** : Gestion thread-safe via `Mutex` et persistance atomique JSON.

### Frontend (React ⚛️)

* **Langage** : TypeScript
* **Build Tool** : Vite
* **Styles** : CSS Modulaire
* **Export** : `jspdf`, `jspdf-autotable`
* **Architecture** :
    * `hooks/` : Logique métier (Custom Hooks).
    * `services/` : Pont vers les commandes Rust.
    * `components/` : Composants UI réutilisables.

## 📂 Structure du Projet

```
mam-plannings/
├── src/                     # Frontend React
│   ├── components/          # UI (DayTable, MonthlyTable, TeamManager...)
│   ├── hooks/               # usePlanning, useTeam...
│   ├── services/            # planningService.ts (Appels Tauri)
│   ├── utils/               # pdfExporter.ts, formatters.ts
│   ├── App.tsx              # Point d'entrée
│   └── main.tsx
├── src-tauri/               # Backend Rust
│   ├── src/
│   │   ├── algorithm.rs     # Logique de calcul des shifts
│   │   ├── commands.rs      # Fonctions exposées au JS
│   │   ├── models.rs        # Structs (Day, Child, Assistant...)
│   │   ├── parsing.rs       # Extraction PDF
│   │   ├── state.rs         # Gestion sauvegarde JSON
│   │   └── lib.rs           # Point d'entrée
│   ├── tauri.conf.json      # Config Tauri (Permissions, Fenêtres...)
│   └── capabilities/        # Permissions système (FS, Dialog)
└── package.json
```

## 🚀 Installation et Développement

### Prérequis

* **Node.js** (v18+)
* **Rust** (via [Rustup](https://rustup.rs/))
* **Dépendances Système** (Linux uniquement) :
  ```bash
  sudo apt update && sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Lancer en mode Dev

1.  Installer les dépendances JS :
    ```bash
    npm install
    ```
2.  Lancer l'application :
    ```bash
    npm run tauri dev
    ```

### Vérifier la qualité du code (Linting)

Le projet utilise ESLint et Prettier configurés pour React/TypeScript.

```bash
# Vérifier les erreurs
npm run lint

# Corriger automatiquement le formatage
npm run format
```

## 📦 Compilation (Build)

Pour créer l'exécutable final (`.exe` sur Windows, `.deb` sur Linux, `.dmg` sur Mac).

```bash
npm run tauri build
```

Les fichiers seront générés dans `src-tauri/target/release/bundle/`.

### Note pour Linux (AppImage)

Si vous rencontrez une erreur liée à `linuxdeploy` ou FUSE sur des distributions récentes (Fedora, Ubuntu 24.04), utilisez :

```bash
NO_STRIP=true npm run tauri build
```

## 🛡️ Sécurité et Données

* **Local-First** : Toutes les données sont stockées localement sur la machine de l'utilisateur (`AppData` ou `~/.local/share`). Aucune donnée ne transite sur le cloud.
* **Écriture Atomique** : Le système de sauvegarde écrit d'abord un fichier temporaire avant de renommer, évitant la corruption de données en cas de crash.

## 👤 Auteur

Développé avec passion pour simplifier la vie des MAMs.

* **Victor Gautier**