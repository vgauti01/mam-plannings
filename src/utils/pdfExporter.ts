import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
      const shift = day.am.find((s) => s.am_id === amId);
      if (shift && shift.heures.length > 0) {
        // On concatène les plages horaires s'il y en a plusieurs (ex: "08h00-12h00 / 14h00-18h00")
        const text = shift.heures
          .map(
            (h) => `${minutesToTime(h.arrivee)} - ${minutesToTime(h.depart)}`
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
      const shift = day.am.find((s) => s.am_id === amId);
      if (shift) {
        shift.heures.forEach((h) => (totalMinutes += h.depart - h.arrivee));
      }
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

/**
 * Convertit un index de colonne (0-based) en lettre Excel
 * @param index 0 → A, 1 → B, 26 → AA, etc.
 * @returns Lettre de colonne Excel
 */
const getExcelColumnLetter = (index: number): string => {
  let letter = "";
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

/**
 * Génère un fichier Excel (XLSX) du planning mensuel.
 * Ce format est facilement modifiable par l'utilisateur dans Excel, LibreOffice, etc.
 *
 * @param days Liste des jours du planning
 * @param team Liste des profils des assistants maternels
 * @param currentMonth Date représentant le mois courant à générer
 * @return Promise<boolean> true si le fichier a été enregistré avec succès
 */
export const generateMonthlyExcel = async (
  days: Day[],
  team: AssistantProfile[],
  currentMonth: Date
): Promise<boolean> => {
  // 1. Filtrage des données pour le mois courant
  const monthDays = days.filter((d) => isSameMonth(d.date, currentMonth));

  // 2. Déterminer les colonnes AM nécessaires
  let maxAmId = 0;
  monthDays.forEach((d) =>
    d.am.forEach((s) => {
      if (s.am_id > maxAmId) maxAmId = s.am_id;
    })
  );
  const columnCount = Math.max(team.length, maxAmId + 1);
  const amIds = Array.from({ length: columnCount }, (_, i) => i);

  // 2b. Déterminer le nombre maximum de shifts par jour dans le mois
  let maxShiftsPerDay = 1;
  monthDays.forEach((d) => {
    d.am.forEach((s) => {
      if (s.heures.length > maxShiftsPerDay) {
        maxShiftsPerDay = s.heures.length;
      }
    });
  });

  // 3. Créer les données du tableau avec colonnes séparées Arrivée/Départ
  const headers = ["Date"];
  amIds.forEach((id) => {
    const amName = team.find((t) => t.id === id)?.name || `AM ${id + 1}`;
    // Créer dynamiquement les colonnes en fonction du nombre max de shifts
    for (let i = 1; i <= maxShiftsPerDay; i++) {
      headers.push(`${amName}_Arr${i}`); // Arrivée shift i
      headers.push(`${amName}_Dép${i}`); // Départ shift i
    }
    headers.push(`${amName}_Total`); // Total heures du jour
  });

  const dataRows = monthDays.map((day, dayIndex) => {
    const row: (string | number | { f: string })[] = [formatDayLabel(day.date)];

    amIds.forEach((amId, amIndex) => {
      const shift = day.am.find((s) => s.am_id === amId);

      // Convertir les minutes en valeur Excel TIME (fraction de jour)
      // Excel TIME: 0 = minuit, 0.5 = midi, 1 = minuit suivant
      const minutesToExcelTime = (minutes: number) => minutes / 1440;

      // Ajouter toutes les paires Arrivée/Départ pour chaque shift possible
      for (let shiftNum = 0; shiftNum < maxShiftsPerDay; shiftNum++) {
        if (shift && shift.heures[shiftNum]) {
          const currentShift = shift.heures[shiftNum];
          row.push(minutesToExcelTime(currentShift.arrivee));
          row.push(minutesToExcelTime(currentShift.depart));
        } else {
          row.push(""); // Pas de shift à cet index
          row.push("");
        }
      }

      // Total du jour : formule calculant somme de tous les shifts
      // Colonnes : Date=0, puis pour chaque AM: Arr1, Dép1, Arr2, Dép2, ..., Total
      // Nombre de colonnes par AM = maxShiftsPerDay * 2 + 1 (Total)
      const colsPerAm = maxShiftsPerDay * 2 + 1;
      const baseCol = 1 + amIndex * colsPerAm;
      const rowNum = dayIndex + 2; // +2 car ligne 1 = headers

      // Construire la formule dynamiquement
      const formulaParts: string[] = [];
      for (let i = 0; i < maxShiftsPerDay; i++) {
        const arrCol = getExcelColumnLetter(baseCol + i * 2);
        const depCol = getExcelColumnLetter(baseCol + i * 2 + 1);
        formulaParts.push(
          `IF(${arrCol}${rowNum}="",0,(${depCol}${rowNum}-${arrCol}${rowNum})*24)`
        );
      }

      const formula = formulaParts.join("+");
      row.push({ f: formula });
    });

    return row;
  });

  // 4. Créer les totaux avec formules Excel
  const lastDataRow = dataRows.length + 1; // +1 pour la ligne d'en-tête
  const totalsRow: (string | { f: string })[] = ["TOTAL"];

  amIds.forEach((_amId, index) => {
    // Nombre de colonnes par AM = maxShiftsPerDay * 2 (Arr/Dép) + 1 (Total)
    const colsPerAm = maxShiftsPerDay * 2 + 1;
    const totalColIndex = 1 + index * colsPerAm + maxShiftsPerDay * 2; // Sauter toutes les Arr/Dép
    const totalCol = getExcelColumnLetter(totalColIndex);

    // Formule pour sommer tous les totaux du mois et formater en "XXhYY"
    const formula = `TEXT(FLOOR(SUM(${totalCol}2:${totalCol}${lastDataRow}),1),"0")&"h"&TEXT(MOD(SUM(${totalCol}2:${totalCol}${lastDataRow}),1)*60,"00")`;

    // Colonnes vides pour toutes les paires Arr/Dép
    for (let i = 0; i < maxShiftsPerDay * 2; i++) {
      totalsRow.push("");
    }
    // Formule dans la colonne Total
    totalsRow.push({ f: formula });
  });

  // 5. Assembler toutes les lignes
  const allRows = [headers, ...dataRows, [], totalsRow];

  // 6. Créer le workbook et la worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allRows);

  // 7. Définir la largeur des colonnes et le format
  const colWidths: Array<{ wch: number }> = [{ wch: 15 }]; // Colonne Date
  amIds.forEach(() => {
    // Pour chaque AM, ajouter les colonnes Arr/Dép de chaque shift
    for (let i = 0; i < maxShiftsPerDay; i++) {
      colWidths.push({ wch: 12 }); // Arrivée
      colWidths.push({ wch: 12 }); // Départ
    }
    colWidths.push({ wch: 10 }); // Total
  });
  worksheet["!cols"] = colWidths;

  // 8. Formater les colonnes TIME (hh:mm) et Total (nombre décimal)
  // Pour chaque cellule de données (pas les headers ni totaux)
  dataRows.forEach((_row, rowIndex) => {
    const excelRow = rowIndex + 2; // +2 car row 1 = headers, row 2 = première donnée
    amIds.forEach((_amId, amIndex) => {
      const colsPerAm = maxShiftsPerDay * 2 + 1;
      const baseCol = 1 + amIndex * colsPerAm;

      // Format TIME pour toutes les paires Arr/Dép
      for (let i = 0; i < maxShiftsPerDay * 2; i++) {
        const cellAddress = `${getExcelColumnLetter(baseCol + i)}${excelRow}`;
        if (
          worksheet[cellAddress] &&
          typeof worksheet[cellAddress].v === "number"
        ) {
          worksheet[cellAddress].z = "hh:mm"; // Format Excel TIME
        }
      }
      // Format numérique pour Total (dernière colonne de l'AM)
      const totalCellAddress = `${getExcelColumnLetter(baseCol + maxShiftsPerDay * 2)}${excelRow}`;
      if (worksheet[totalCellAddress]) {
        worksheet[totalCellAddress].z = "0.00"; // Format décimal 2 chiffres
      }
    });
  });

  // 9. Configuration d'impression
  // Geler la première ligne (en-têtes) pour faciliter la lecture
  worksheet["!freeze"] = { xSplit: 1, ySplit: 1 };

  // Définir les marges d'impression (en pouces)
  worksheet["!margins"] = {
    left: 0.5,
    right: 0.5,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };

  // Répéter la ligne d'en-têtes sur chaque page imprimée
  worksheet["!rows"] = [{ hpx: 20 }]; // Hauteur de la première ligne (headers)

  // 10. Créer le workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    formatMonthYear(currentMonth)
  );

  // 11. Générer le fichier binaire
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  // 12. Sauvegarder avec la boîte de dialogue Tauri
  const fileName = `Planning_${formatMonthYear(currentMonth).replace(" ", "_")}.xlsx`;

  try {
    const filePath = await save({
      defaultPath: fileName,
      filters: [
        {
          name: "Excel",
          extensions: ["xlsx"],
        },
      ],
    });

    if (filePath) {
      const binaryData = new Uint8Array(excelBuffer);
      await writeFile(filePath, binaryData);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Erreur lors de l'enregistrement du fichier Excel :", e);
    alert("Impossible d'enregistrer le fichier.");
    return false;
  }
};
