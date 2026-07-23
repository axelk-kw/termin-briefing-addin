/* Zentrale Vorauswahl-Listen für das Briefing-Formular.
 *
 * NEUE PERMANENTE OPTION ERGÄNZEN?
 *   1. Hier eine Zeile in der passenden Liste hinzufügen (Anführungszeichen + Komma beachten)
 *   2. Speichern, dann:  git add options.js && git commit -m "Option ergänzt" && git push
 *   3. Fertig — beim nächsten Öffnen des Formulars ist die Option überall da.
 *      (Kein Admin-Center, keine Neuinstallation nötig.)
 *
 * Hinweis: Optionsnamen sollten kein Komma und kein Semikolon enthalten,
 * da diese Zeichen im Briefing-Block als Trenner dienen.
 */
var BRIEFING_OPTIONS = {

  // Thema des Termins — genau EINE Auswahl, steht ganz oben im Formular
  themen: [
    "Neulieferung",
    "Service-Termin",
    "Vor-Ort-Planung/Baubesprechung",
    "Reparatur vor Ort",
    "Reparatur-Abholung/Rücklieferung",
  ],

  // Je Thema: welche Vorauswahlen unten angezeigt werden (filterbar: werkzeug, zubehoer).
  //   - Thema ohne Eintrag hier  -> ALLE Optionen anzeigen (z. B. Service-Termin)
  //   - Feld weggelassen         -> alle Optionen dieses Feldes anzeigen
  //   - Feld mit Liste           -> nur diese anzeigen ([] = keine Vorauswahl, nur Sonstiges)
  // Bereits angehakte Optionen bleiben immer sichtbar — es geht nichts verloren.
  // Die Zuordnungen sind Startwerte — einfach anpassen wie oben beschrieben.
  themenFilter: {
    "Neulieferung":                     { werkzeug: ["Bohrmaschine", "Messgerät", "Sackkarre"], zubehoer: ["Wandhalter"] },
    "Vor-Ort-Planung/Baubesprechung":   { werkzeug: ["Messgerät"], zubehoer: [] },
    "Reparatur vor Ort":                { werkzeug: ["große Leiter", "Bohrmaschine", "Messgerät"], zubehoer: [] },
    "Reparatur-Abholung/Rücklieferung": { werkzeug: ["Sackkarre"], zubehoer: [] },
    // "Service-Termin": bewusst kein Eintrag -> alles anzeigen
  },

  // Produkttyp — Mehrfachauswahl, je Typ optionales Textfeld fürs genaue Produkt
  // (wird als "Produkt: TV: Loewe stellar 55; HiFi" im Block gespeichert)
  produktTypen: [
    "TV",
    "HiFi",
    "Haushaltsgerät",
    "Computer",
    "Netzwerk",
    "SAT-/Kabel-Anschluss",
  ],

  // Produkt-Merkmale — Häkchen in der Produkt-Gruppe (landen mit in der Produkt-Zeile)
  produktMerkmale: [
    "Wertgarantie",
  ],

  // Werkzeug — abhakbare Standard-Ausrüstung
  werkzeug: [
    "große Leiter",
    "Bohrmaschine",
    "Messgerät",
    "Sackkarre",
  ],

  // Zubehör — abhakbare Standard-Artikel
  zubehoer: [
    "Wandhalter",
    "Ext. Festplatte",
  ],

  // Zahlung — genau EINE Auswahl (Radioknöpfe)
  zahlung: [
    "Bar",
    "EC-Karte",
    "Rechnung",
    "Kulanz/Bereits bezahlt",
  ],

  // Kunde: Art — genau EINE Auswahl
  kundeArt: [
    "Neukunde",
    "Bestandskunde",
  ],

  // Kunde: Merkmale — mehrere möglich
  // (Wertgarantie steht bewusst bei den Produkt-Merkmalen — sie gehört zum Gerät)
  kundeMerkmale: [
    "Konkurrenzkunde",
    "Google Kunde",
  ],

  // Hinweise — abhakbare Standard-Hinweise
  hinweise: [
    "Kunden vorher kontaktieren",
    "Fixtermin",
  ],
};
