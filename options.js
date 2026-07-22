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
  kundeMerkmale: [
    "Wertgarantie",
    "Konkurrenzkunde",
    "Google Kunde",
  ],

  // Hinweise — abhakbare Standard-Hinweise
  hinweise: [
    "Kunden vorher kontaktieren",
    "Fixtermin",
  ],
};
