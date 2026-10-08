/* Termin-Briefing Add-in — fügt die (leere) Briefing-Vorlage in einen Termin ein.
 *
 * Zwei Wege, beide nutzen dieselbe Logik:
 *   1) onNewAppointment  – feuert automatisch beim Anlegen eines neuen Termins
 *                          (ereignisbasierte Aktivierung, OnNewAppointmentOrganizer)
 *   2) insertBriefing    – der Ribbon-Knopf (fügt die Vorlage nachträglich ein)
 *
 * Eingefügt werden direkt alle Feldzeilen ("Kunde: ", "Thema: " …) — ohne Kopf-/Fußzeile.
 * Man tippt einfach hinter die Doppelpunkte; das Formular (taskpane.js) ist optional und
 * erkennt den Block an seinen Feldzeilen. Muss zeichengleich zu taskpane.js
 * (buildBlockLines mit leeren Werten) und prefill.py (build_block) bleiben.
 */

// Feldreihenfolge wie FIELD_ORDER/FIELD_NAME in taskpane.js
var TEMPLATE_FIELDS = ["Kunde", "Thema", "Produkt", "Ware", "Kaufdatum", "Seriennummer",
  "Werkzeug", "Zubehör", "Zahlung", "Hinweise"];

// Erkennt einen bereits vorhandenen Block: alter Startmarker (Altbestand / prefill.py)
// oder eine Kunde-Feldzeile am Zeilenanfang (neues Format ohne Marker).
var LEGACY_START_RE = /---\s*BRIEFING\s*---/i;
var FIELD_START_RE = /^\s*Kunde(?:ninfo)?\s*:/im;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Leere Vorlage als HTML — identisch zu taskpane.blockFullHtml({}) und prefill.build_block().
function buildBlockHtml() {
  var lines = [];
  TEMPLATE_FIELDS.forEach(function (name, i) {
    lines.push(name + ": ");
    if (i < TEMPLATE_FIELDS.length - 1) lines.push("");
  });
  var inner = lines.map(escapeHtml).join("<br>");
  return '<div style="font-family:Aptos,Calibri,sans-serif;font-size:12pt">' + inner + "</div>";
}

function hasBlock(text) {
  return LEGACY_START_RE.test(text || "") || FIELD_START_RE.test(text || "");
}

// Gemeinsame Einfüge-Logik: nur einfügen, wenn noch kein Block da ist (nie überschreiben).
function insertIfAbsent(done) {
  var item = Office.context.mailbox.item;
  item.body.getAsync(Office.CoercionType.Text, function (res) {
    if (res.status === Office.AsyncResultStatus.Succeeded && hasBlock(res.value)) {
      done();                       // schon vorhanden -> nichts tun
      return;
    }
    item.body.prependAsync(
      buildBlockHtml(),
      { coercionType: Office.CoercionType.Html },
      function () { done(); }        // Fehler ignorieren wir bewusst: lieber nichts einfügen als den Termin blockieren
    );
  });
}

// (1) Automatisch beim Anlegen eines neuen Termins.
function onNewAppointment(event) {
  insertIfAbsent(function () { event.completed(); });
}

// (2) Manueller Ribbon-Knopf.
function insertBriefing(event) {
  insertIfAbsent(function () { event.completed(); });
}

// Registrierung im Shared Runtime (nötig für ereignisbasierte Aktivierung + Ribbon-Funktionen).
if (typeof Office !== "undefined") Office.onReady();
if (typeof Office !== "undefined" && Office.actions && Office.actions.associate) {
  Office.actions.associate("onNewAppointment", onNewAppointment);
  Office.actions.associate("insertBriefing", insertBriefing);
}

/* Export für den Node-Test (im Browser wirkungslos) */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildBlockHtml: buildBlockHtml, hasBlock: hasBlock };
}
