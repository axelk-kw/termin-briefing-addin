/* Termin-Briefing Add-in — fügt den Briefing-Block in einen Termin ein.
 *
 * Zwei Wege, beide nutzen dieselbe Logik:
 *   1) onNewAppointment  – feuert automatisch beim Anlegen eines neuen Termins
 *                          (ereignisbasierte Aktivierung, OnNewAppointmentOrganizer)
 *   2) insertBriefing    – der Ribbon-Knopf "Briefing einfügen" (manueller Fallback,
 *                          funktioniert auf allen Plattformen inkl. Mac)
 *
 * Der eingefügte Block ist zeichengleich zu prefill.py (build_block/block_as_html),
 * damit das Digest-Tool ihn unverändert parst.
 */

// Feldreihenfolge = FIELDS_FULL aus prefill.py (Vollvariante mit Werkzeug).
// Beim manuellen Anlegen ist die Kategorie i. d. R. noch nicht gesetzt, daher immer
// die volle Liste — überzählige Zeilen (z. B. Werkzeug im Laden) kann man löschen.
var FIELDS = ["Mitnehmen", "Werkzeug", "Zubehör", "Beim Kunden", "Zahlung", "Kunde", "Hinweise"];
var MARK_HINT = "(diese Zeile bitte nicht löschen)";

// Erkennt einen bereits vorhandenen Block (gleiche Regex wie BLOCK_RE, Startmarker genügt).
var BLOCK_START_RE = /---\s*BRIEFING\s*---/i;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Baut den Block als HTML — entspricht build_block() + block_as_html() in prefill.py:
// Marker mit Hinweis, dann je Feld "Name: " mit einer Leerzeile dazwischen.
function buildBlockHtml() {
  var lines = [];
  lines.push("--- BRIEFING ---   " + MARK_HINT);
  for (var i = 0; i < FIELDS.length; i++) {
    lines.push(FIELDS[i] + ": ");
    if (i < FIELDS.length - 1) lines.push("");   // Leerzeile zwischen den Feldern
  }
  lines.push("--- ENDE ---   " + MARK_HINT);

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
