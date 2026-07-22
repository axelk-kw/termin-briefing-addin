/* Briefing-Formular (Taskpane) — liest den Briefing-Block aus dem Termin,
 * zeigt ihn als Formular mit Vorauswahlen (options.js) und schreibt beim
 * Übernehmen den Textblock zurück. Der Block bleibt zeichenkompatibel zum
 * Digest-Parser (briefing.py) — das Tool merkt nicht, dass ein Formular
 * dahintersteckt.
 *
 * Aufbau: oben reine Logik (ohne DOM, per Node testbar), unten DOM-Glue.
 */

/* ============================= reine Logik ============================= */

var MARK_HINT = "(diese Zeile bitte nicht löschen)";
var BLOCK_TEXT_RE = /---\s*BRIEFING\s*---([\s\S]*?)---\s*ENDE\s*---/i;
// Im HTML-Body: vom Startmarker bis Endmarker inkl. Hinweistext dahinter,
// aber ohne umschließende Tags — so bleibt die Formatierung (div) erhalten.
var BLOCK_HTML_RE = /---\s*BRIEFING\s*---[\s\S]*?---\s*ENDE\s*---[^<]*/i;

// Feld-Beschriftungen wie in briefing.py (FIELDS), inkl. erkannter Varianten
var FIELD_LABELS = {
  mitnehmen:   ["Mitnehmen", "Produkte", "Ware"],
  werkzeug:    ["Werkzeug"],
  zubehoer:    ["Zubehör", "Zubehoer", "Zubehör vor Ort"],
  beim_kunden: ["Beim Kunden", "Vorhanden", "Hat bereits"],
  zahlung:     ["Zahlung", "Bezahlung"],
  kunde:       ["Kunde", "Kundeninfo"],
  hinweise:    ["Hinweise", "Hinweis"],
};
var FIELD_ORDER = ["mitnehmen", "werkzeug", "zubehoer", "beim_kunden", "zahlung", "kunde", "hinweise"];
var FIELD_NAME = { mitnehmen: "Mitnehmen", werkzeug: "Werkzeug", zubehoer: "Zubehör",
  beim_kunden: "Beim Kunden", zahlung: "Zahlung", kunde: "Kunde", hinweise: "Hinweise" };

var EMPTY_VALUES = ["", "keine", "keins", "keiner", "nichts", "-", "—", "n/a", "nein"];

function isEmptyValue(s) { return EMPTY_VALUES.indexOf((s || "").trim().toLowerCase()) >= 0; }

function splitItems(raw) {
  raw = (raw || "").trim();
  if (isEmptyValue(raw)) return [];
  var sep = raw.indexOf(";") >= 0 ? ";" : ",";
  return raw.split(sep).map(function (s) { return s.trim(); }).filter(Boolean);
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Rohe Feldwerte aus dem Body-Text lesen: { found: bool, fields: {key: "roher Wert"} }
function parseBlockText(bodyText) {
  var res = { found: false, fields: {} };
  var m = BLOCK_TEXT_RE.exec(bodyText || "");
  if (!m) return res;
  res.found = true;
  var lookup = {};
  Object.keys(FIELD_LABELS).forEach(function (key) {
    FIELD_LABELS[key].forEach(function (lab) { lookup[lab.toLowerCase()] = key; });
  });
  m[1].split(/\r?\n/).forEach(function (line) {
    var lm = /^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß /]*?)\s*:\s*(.*)$/.exec(line);
    if (!lm) return;
    var key = lookup[lm[1].trim().toLowerCase()];
    if (key) res.fields[key] = lm[2].trim();
  });
  return res;
}

/* --- Rohwert -> Formular-Zustand (je Feldtyp) --- */

// Packliste mit Vorauswahl: bekannte Einträge ankreuzen, Rest -> Sonstiges
function packState(raw, presets) {
  var st = { keine: false, checked: [], sonstiges: "" };
  if (raw !== undefined && raw !== "" && isEmptyValue(raw)) { st.keine = true; return st; }
  var rest = [];
  splitItems(raw).forEach(function (item) {
    var hit = presets.find(function (p) { return p.toLowerCase() === item.toLowerCase(); });
    if (hit) st.checked.push(hit); else rest.push(item);
  });
  st.sonstiges = rest.join(", ");
  return st;
}

function zahlungState(raw, methods) {
  var st = { methode: "", betrag: "", zusatz: "" };
  if (!raw || isEmptyValue(raw)) return st;
  var rest = raw;
  var b = /(\d+(?:[.,]\d+)?)\s*(?:€|eur\b)/i.exec(rest);
  if (b) { st.betrag = b[1]; rest = rest.replace(b[0], ""); }
  for (var i = 0; i < methods.length; i++) {
    var name = methods[i];
    var re = name === "Kulanz/Bereits bezahlt" ? /kulanz(?:\s*\/\s*bereits bezahlt)?|bereits bezahlt/i
      : name === "EC-Karte" ? /\bec(?:-karte)?\b/i
      : name === "Bar" ? /\bbar\b/i
      : new RegExp("\\b" + escRe(name) + "\\b", "i");
    if (re.test(rest)) { st.methode = name; rest = rest.replace(re, ""); break; }
  }
  st.zusatz = rest.replace(/\bper\b/i, "").replace(/[,;/–-]+/g, " ").replace(/\s+/g, " ").trim();
  return st;
}

function kundeState(raw, opts) {
  var st = { art: "", merkmale: [], tel: "", mail: "", sonstiges: "" };
  var rest = [];
  splitItems(raw).forEach(function (tok) {
    var artHit = opts.kundeArt.find(function (a) { return a.toLowerCase() === tok.toLowerCase(); });
    if (artHit) { st.art = artHit; return; }
    var mHit = opts.kundeMerkmale.find(function (a) { return a.toLowerCase() === tok.toLowerCase(); });
    if (mHit) { st.merkmale.push(mHit); return; }
    var tel = /^tel\.?:?\s*(.+)$/i.exec(tok);
    if (tel) { st.tel = tel[1].trim(); return; }
    var mail = /^(?:e-?mail|mail)\.?:?\s*(.+)$/i.exec(tok);
    if (mail) { st.mail = mail[1].trim(); return; }
    rest.push(tok);
  });
  st.sonstiges = rest.join(", ");
  return st;
}

function hinweiseState(raw, presets) {
  var st = { checked: [], freitext: "" };
  var rest = [];
  (raw || "").split(";").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (tok) {
    var hit = presets.find(function (p) { return p.toLowerCase() === tok.toLowerCase(); });
    if (hit) st.checked.push(hit); else rest.push(tok);
  });
  st.freitext = rest.join("; ");
  return st;
}

// Body-Text -> kompletter Formular-Zustand
function stateFromBody(bodyText, opts) {
  var parsed = parseBlockText(bodyText);
  var f = parsed.fields;
  return {
    found: parsed.found,
    mitnehmen: packState(f.mitnehmen, []),
    werkzeug: packState(f.werkzeug, opts.werkzeug),
    zubehoer: packState(f.zubehoer, opts.zubehoer),
    beim_kunden: (f.beim_kunden && !isEmptyValue(f.beim_kunden)) ? f.beim_kunden : "",
    zahlung: zahlungState(f.zahlung, opts.zahlung),
    kunde: kundeState(f.kunde, opts),
    hinweise: hinweiseState(f.hinweise, opts.hinweise),
  };
}

/* --- Formular-Zustand -> Feldwerte (eine Zeile je Feld, keine Zeilenumbrüche!) --- */

function flat(s) { return (s || "").replace(/\s*\r?\n\s*/g, "; ").trim(); }

function packValue(st) {
  if (st.keine) return "keine";
  var items = st.checked.concat(splitItems(st.sonstiges));
  return items.join(", ");
}

function zahlungValue(st) {
  var parts = [];
  if (st.methode) parts.push(st.betrag ? st.betrag + " € per " + st.methode : st.methode);
  else if (st.betrag) parts.push(st.betrag + " €");
  if (st.zusatz) parts.push(st.zusatz.trim());
  return parts.join(", ");
}

function kundeValue(st) {
  var parts = [];
  if (st.art) parts.push(st.art);
  st.merkmale.forEach(function (m) { parts.push(m); });
  if (st.tel) parts.push("Tel " + st.tel.trim());
  if (st.mail) parts.push("Mail " + st.mail.trim());
  if (st.sonstiges) parts.push(st.sonstiges.trim());
  return parts.join(", ");
}

function hinweiseValue(st) {
  var parts = st.checked.slice();
  if (st.freitext) parts.push(flat(st.freitext));
  return parts.join("; ");
}

function valuesFromState(st) {
  return {
    mitnehmen: st.mitnehmen.keine ? "keine"
      : splitItems(flat(st.mitnehmen.sonstiges).replace(/;/g, ",")).join(", "),
    werkzeug: packValue(st.werkzeug),
    zubehoer: packValue(st.zubehoer),
    beim_kunden: flat(st.beim_kunden),
    zahlung: zahlungValue(st.zahlung),
    kunde: kundeValue(st.kunde),
    hinweise: hinweiseValue(st.hinweise),
  };
}

// Blocktext bauen — Format identisch zu prefill.py (Leerzeile zwischen Feldern)
function buildBlockLines(values) {
  var lines = ["--- BRIEFING ---   " + MARK_HINT];
  FIELD_ORDER.forEach(function (key, i) {
    lines.push(FIELD_NAME[key] + ": " + (values[key] || ""));
    if (i < FIELD_ORDER.length - 1) lines.push("");
  });
  lines.push("--- ENDE ---   " + MARK_HINT);
  return lines;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function blockInnerHtml(values) {
  return buildBlockLines(values).map(escapeHtml).join("<br>");
}

function blockFullHtml(values) {
  return '<div style="font-family:Aptos,Calibri,sans-serif;font-size:12pt">'
    + blockInnerHtml(values) + "</div>";
}

/* ============================= DOM-Teil ============================= */
/* global document, Office, BRIEFING_OPTIONS */

function $(id) { return document.getElementById(id); }

function checkboxRow(name, value, checked) {
  var id = name + "_" + value.replace(/\W+/g, "_");
  return '<label class="row"><input type="checkbox" id="' + id + '" data-group="' + name +
    '" value="' + value + '"' + (checked ? " checked" : "") + "> " + value + "</label>";
}

function radioRow(name, value, checked) {
  var id = name + "_" + value.replace(/\W+/g, "_");
  return '<label class="row"><input type="radio" id="' + id + '" name="' + name +
    '" value="' + value + '"' + (checked ? " checked" : "") + "> " + value + "</label>";
}

function renderForm(st, opts) {
  $("f_mitnehmen").value = st.mitnehmen.sonstiges.split(", ").filter(Boolean).join("\n");
  $("k_mitnehmen").checked = st.mitnehmen.keine;

  $("g_werkzeug").innerHTML = opts.werkzeug.map(function (o) {
    return checkboxRow("werkzeug", o, st.werkzeug.checked.indexOf(o) >= 0);
  }).join("");
  $("s_werkzeug").value = st.werkzeug.sonstiges;
  $("k_werkzeug").checked = st.werkzeug.keine;

  $("g_zubehoer").innerHTML = opts.zubehoer.map(function (o) {
    return checkboxRow("zubehoer", o, st.zubehoer.checked.indexOf(o) >= 0);
  }).join("");
  $("s_zubehoer").value = st.zubehoer.sonstiges;
  $("k_zubehoer").checked = st.zubehoer.keine;

  $("f_beim_kunden").value = st.beim_kunden;

  $("g_zahlung").innerHTML = opts.zahlung.map(function (o) {
    return radioRow("zahlung", o, st.zahlung.methode === o);
  }).join("");
  $("f_betrag").value = st.zahlung.betrag;
  $("f_zahlung_zusatz").value = st.zahlung.zusatz;

  $("g_kunde_art").innerHTML = opts.kundeArt.map(function (o) {
    return radioRow("kundeArt", o, st.kunde.art === o);
  }).join("");
  $("g_kunde_merkmale").innerHTML = opts.kundeMerkmale.map(function (o) {
    return checkboxRow("kundeMerkmale", o, st.kunde.merkmale.indexOf(o) >= 0);
  }).join("");
  $("f_tel").value = st.kunde.tel;
  $("f_mail").value = st.kunde.mail;
  $("s_kunde").value = st.kunde.sonstiges;

  $("g_hinweise").innerHTML = opts.hinweise.map(function (o) {
    return checkboxRow("hinweise", o, st.hinweise.checked.indexOf(o) >= 0);
  }).join("");
  $("f_hinweise").value = st.hinweise.freitext;
}

function checkedValues(group) {
  return Array.prototype.slice.call(
    document.querySelectorAll('input[data-group="' + group + '"]:checked')
  ).map(function (el) { return el.value; });
}

function radioValue(name) {
  var el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : "";
}

function readForm() {
  return {
    mitnehmen: { keine: $("k_mitnehmen").checked, checked: [], sonstiges: $("f_mitnehmen").value },
    werkzeug: { keine: $("k_werkzeug").checked, checked: checkedValues("werkzeug"), sonstiges: $("s_werkzeug").value },
    zubehoer: { keine: $("k_zubehoer").checked, checked: checkedValues("zubehoer"), sonstiges: $("s_zubehoer").value },
    beim_kunden: $("f_beim_kunden").value,
    zahlung: { methode: radioValue("zahlung"), betrag: $("f_betrag").value.trim(), zusatz: $("f_zahlung_zusatz").value },
    kunde: { art: radioValue("kundeArt"), merkmale: checkedValues("kundeMerkmale"),
      tel: $("f_tel").value, mail: $("f_mail").value, sonstiges: $("s_kunde").value },
    hinweise: { checked: checkedValues("hinweise"), freitext: $("f_hinweise").value },
  };
}

function setStatus(msg, ok) {
  var el = $("status");
  el.textContent = msg;
  el.className = ok ? "status ok" : "status err";
}

function loadFromItem() {
  // Ohne Outlook-Kontext (z. B. Browser-Vorschau): leeres Formular anzeigen
  if (!Office.context || !Office.context.mailbox || !Office.context.mailbox.item) {
    renderForm(stateFromBody("", BRIEFING_OPTIONS), BRIEFING_OPTIONS);
    return;
  }
  Office.context.mailbox.item.body.getAsync(Office.CoercionType.Text, function (res) {
    if (res.status !== Office.AsyncResultStatus.Succeeded) {
      setStatus("Termin-Text konnte nicht gelesen werden.", false);
      renderForm(stateFromBody("", BRIEFING_OPTIONS), BRIEFING_OPTIONS);
      return;
    }
    renderForm(stateFromBody(res.value, BRIEFING_OPTIONS), BRIEFING_OPTIONS);
  });
}

function save() {
  var values = valuesFromState(readForm());
  var item = Office.context.mailbox.item;
  item.body.getAsync(Office.CoercionType.Html, function (res) {
    if (res.status !== Office.AsyncResultStatus.Succeeded) {
      setStatus("Termin-Text konnte nicht gelesen werden.", false);
      return;
    }
    var html = res.value || "";
    var done = function (r) {
      if (r.status === Office.AsyncResultStatus.Succeeded) setStatus("✓ Übernommen.", true);
      else setStatus("Schreiben fehlgeschlagen — bitte erneut versuchen.", false);
    };
    if (BLOCK_HTML_RE.test(html)) {
      // vorhandenen Block ersetzen (Formatierung/Umgebung bleibt stehen)
      var neu = html.replace(BLOCK_HTML_RE, blockInnerHtml(values));
      item.body.setAsync(neu, { coercionType: Office.CoercionType.Html }, done);
    } else {
      item.body.prependAsync(blockFullHtml(values), { coercionType: Office.CoercionType.Html }, done);
    }
  });
}

if (typeof Office !== "undefined" && typeof document !== "undefined" && Office.onReady) {
  Office.onReady(function () {
    loadFromItem();
    $("save").addEventListener("click", save);
    $("reload").addEventListener("click", loadFromItem);
  });
}

/* Export für den Node-Roundtrip-Test (im Browser wirkungslos) */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseBlockText: parseBlockText, stateFromBody: stateFromBody,
    valuesFromState: valuesFromState, buildBlockLines: buildBlockLines,
    blockFullHtml: blockFullHtml, zahlungState: zahlungState };
}
