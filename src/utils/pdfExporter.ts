import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AssistantProfile, Day } from "../types";
import {
  isSameMonth,
  formatDayLabel,
  minutesToTime,
  formatDuration,
  formatMonthYear,
} from "./formatters";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs"; // Pour écrire le fichier

/**
 * Génère un PDF du planning mensuel et propose de l'enregistrer via une boîte de dialogue.
 * Prend en compte un nombre variable d'assistants maternels (AM).
 * Pour chaque jour du mois, affiche les plages horaires de chaque AM.
 *
 * @param days Liste des jours du planning
 * @param team Liste des profils des assistants maternels
 * @param currentMonth Date représentant le mois courant à générer
 *
 * @return Promise<boolean> true si le PDF a été enregistré avec succès, false sinon
 */
export const generateMonthlyPdf = async (
  days: Day[],
  team: AssistantProfile[],
  currentMonth: Date
) => {
  // 1. Initialisation du document (Orientation Portrait par défaut, ou "l" pour Paysage)
  const doc = new jsPDF("l"); // "l" pour Landscape (Paysage) car le tableau est large

  // 2. Filtrage des données
  const monthDays = days.filter((d) => isSameMonth(d.date, currentMonth));
  const title = `Planning MAM - ${formatMonthYear(currentMonth)}`;

  // 3. Configuration des colonnes
  // On détermine combien de colonnes AM sont nécessaires
  let maxAmId = 0;
  monthDays.forEach((d) =>
    d.am.forEach((s) => {
      if (s.am_id > maxAmId) maxAmId = s.am_id;
    })
  );
  const columnCount = Math.max(team.length, maxAmId + 1);
  const amIds = Array.from({ length: columnCount }, (_, i) => i);

  // En-têtes du tableau
  const headRow = [
    "Date",
    ...amIds.map((id) => team.find((t) => t.id === id)?.name || `AM ${id + 1}`),
  ];

  // 4. Préparation des données (Lignes)
  const bodyRows = monthDays.map((day) => {
    const rowData: string[] = [];

    // Colonne Date
    rowData.push(formatDayLabel(day.date));

    // Colonnes AM
    amIds.forEach((amId) => {
      const shifts = day.am.filter((s) => s.am_id === amId);
      if (shifts.length > 0) {
        // On concatène les shifts s'il y en a plusieurs (ex: "08h00-12h00 / 14h00-18h00")
        const text = shifts
          .map(
            (s) => `${minutesToTime(s.arrivee)} - ${minutesToTime(s.depart)}`
          )
          .join("\n");
        rowData.push(text);
      } else {
        rowData.push(""); // Case vide
      }
    });

    return rowData;
  });

  // 5. Calcul des Totaux (Pied de tableau)
  const totals = amIds.map((amId) => {
    let totalMinutes = 0;
    monthDays.forEach((day) => {
      day.am
        .filter((s) => s.am_id === amId)
        .forEach((s) => (totalMinutes += s.depart - s.arrivee));
    });
    return formatDuration(totalMinutes);
  });

  const footRow = ["TOTAL", ...totals];

  // 6. Génération du tableau avec autoTable
  doc.text(title, 14, 15); // Titre en haut à gauche

  autoTable(doc, {
    startY: 20, // Position verticale après le titre
    head: [headRow], // En-tête
    body: bodyRows, // Corps du tableau
    foot: [footRow], // Pied du tableau
    showFoot: "lastPage", // Affiche le pied de tableau uniquement sur la dernière page
    theme: "grid", // Style du tableau (ici avec des bordures)
    headStyles: {
      // Styles de l'en-tête
      fillColor: [60, 60, 60], // Gris foncé pour la colonne "Date" par défaut
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      // Styles du pied de tableau
      fillColor: [241, 243, 245], // Gris clair
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    styles: {
      // Styles généraux
      fontSize: 10,
      cellPadding: 3,
      valign: "middle",
      halign: "center",
    },
    columnStyles: {
      // Styles spécifiques aux colonnes
      0: { fontStyle: "bold", halign: "left", cellWidth: 30 },
    },
    didParseCell: (data) => {
      // 1. Gestion des COULEURS D'EN-TÊTE (AM)
      if (data.section === "head") {
        // Si on n'est pas sur la première colonne (Date)
        if (data.column.index > 0) {
          // On retrouve quel AM correspond à cette colonne
          // (Index - 1 car la colonne 0 est la Date)
          const amId = amIds[data.column.index - 1];
          const am = team.find((t) => t.id === amId);

          if (am) {
            // On applique la couleur de l'AM
            data.cell.styles.fillColor = am.color;

            // Si la couleur est très claire (ex: jaune), on met le texte en noir
            // Sinon on le garde en blanc (défini dans headStyles)
            if (isColorLight(am.color)) {
              data.cell.styles.textColor = [0, 0, 0]; // Noir
            } else {
              data.cell.styles.textColor = 255; // Blanc
            }
          }
        }
      }

      // 2. Gestion des CASES DU TABLEAU (Vert clair si occupé)
      if (data.section === "body" && data.column.index > 0) {
        const text = data.cell.raw;
        if (text && text !== "") {
          data.cell.styles.fillColor = [232, 245, 233]; // Vert clair
        }
      }
    },
  });

  // 7. Sauvegarde
  // Le nom du fichier sera "Planning_Novembre_2025.pdf"
  const fileName = `Planning_${formatMonthYear(currentMonth).replace(" ", "_")}.pdf`;

  // On utilise les API Tauri pour sauvegarder le fichier
  try {
    // 1. On génère le PDF sous forme de données brutes (ArrayBuffer)
    const pdfOutput = doc.output("arraybuffer");

    // 2. On ouvre la boîte de dialogue "Enregistrer sous"
    const filePath = await save({
      defaultPath: fileName,
      filters: [
        {
          name: "PDF",
          extensions: ["pdf"],
        },
      ],
    });

    // 3. Si l'utilisateur n'a pas annulé (filePath n'est pas null)
    if (filePath) {
      // Conversion du ArrayBuffer de jsPDF en Uint8Array (requis par Tauri v2)
      const binaryData = new Uint8Array(pdfOutput);

      // On utilise writeFile (qui remplace writeBinaryFile)
      await writeFile(filePath, binaryData);

      return true;
    }
  } catch (e) {
    console.error("Erreur lors de l'enregistrement du PDF :", e);
    alert("Impossible d'enregistrer le fichier.");
    return false; // Erreur
  }
};

/**
 * Détermine si une couleur hexadécimale est claire ou foncée.
 * Utilisé pour ajuster la couleur du texte en fonction de la couleur de fond.
 * La formule utilisée est basée sur la luminosité perçue.
 * Voir : https://www.w3.org/TR/AERT/#color-contrast
 * @param hex Couleur au format hexadécimal (ex: "#RRGGBB")
 * @return boolean true si la couleur est claire, false si elle est foncée
 */
const isColorLight = (hex: string) => {
  // Enlever le # si présent
  const c = hex.substring(1);
  // Convertir en RGB
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);

  // Formule de luminosité perçue
  const uicolors = [r / 255, g / 255, b / 255];
  const c_map = uicolors.map((col) => {
    if (col <= 0.03928) {
      return col / 12.92;
    }
    return Math.pow((col + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * c_map[0] + 0.7152 * c_map[1] + 0.0722 * c_map[2];

  return L > 0.179; // Si > 0.179, la couleur est considérée claire -> texte noir
};
