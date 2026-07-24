/* Termin-Briefing Add-in — fügt den (leeren) Briefing-Platzhalter in einen Termin ein.
 *
 * Zwei Wege, beide nutzen dieselbe Logik:
 *   1) onNewAppointment  – feuert automatisch beim Anlegen eines neuen Termins
 *                          (ereignisbasierte Aktivierung, OnNewAppointmentOrganizer)
 *   2) insertBriefing    – der Ribbon-Knopf "Briefing ausfüllen" (öffnet das Formular)
 *
 * Eingefügt wird bewusst nur ein schlanker Platzhalter (Kopf + Hinweis + Fuß) statt
 * aller leeren Feldzeilen — das wirkt im Termin aufgeräumt. Sobald das Formular
 * ausgefüllt und "Übernehmen" geklickt wird, ersetzt taskpane.js diesen Platzhalter
 * durch den vollständigen Block (der Hinweis verschwindet dabei automatisch).
 * Muss zeichengleich zu prefill.py (build_block) bleiben.
 */

var MARK_HINT = "(diese Zeile bitte nicht löschen)";
var PLACEHOLDER_HINT = "Bitte über den Knopf »Briefing ausfüllen« erfassen (öffnet das Formular).";

// Erkennt einen bereits vorhandenen Block (gleiche Regex wie BLOCK_RE, Startmarker genügt).
var BLOCK_START_RE = /---\s*BRIEFING\s*---/i;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Schlanker Platzhalter-Block als HTML — identisch zu prefill.build_block().
function buildBlockHtml() {
  var lines = [
    "--- BRIEFING ---   " + MARK_HINT,
    PLACEHOLDER_HINT,
    "--- ENDE ---   " + MARK_HINT,
  ];
  var inner = lines.map(escapeHtml).join("<br>");
  return '<div style="font-family:Aptos,Calibri,sans-serif;font-size:12pt">' + inner + "</div>";
}

// Gemeinsame Einfüge-Logik: nur einfügen, wenn noch kein Block da ist (nie überschreiben).
function insertIfAbsent(done) {
  var item = Office.context.mailbox.item;
  item.body.getAsync(Office.CoercionType.Text, function (res) {
    var hasBlock = res.status === Office.AsyncResultStatus.Succeeded && BLOCK_START_RE.test(res.value || "");
    if (hasBlock) {
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
Office.onReady();
if (typeof Office !== "undefined" && Office.actions && Office.actions.associate) {
  Office.actions.associate("onNewAppointment", onNewAppointment);
  Office.actions.associate("insertBriefing", insertBriefing);
}
