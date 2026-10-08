/* Briefing-Formular (Taskpane) — liest den Briefing-Block aus dem Termin,
 * zeigt ihn als Formular mit Vorauswahlen (options.js) und schreibt beim
 * Übernehmen den Textblock zurück. Der Block bleibt zeichenkompatibel zum
 * Digest-Parser (briefing.py) — das Tool merkt nicht, dass ein Formular
 * dahintersteckt.
 *
 * Aufbau: oben reine Logik (ohne DOM, per Node testbar), unten DOM-Glue.
 */

/* ============================= reine Logik ============================= */

// Der Block besteht nur aus Feldzeilen (Kunde: … bis Hinweise: …), ohne Kopf-/Fußzeile.
// Altbestand mit Markern ("--- BRIEFING --- … --- ENDE ---") wird weiter gelesen und
// beim Übernehmen ins neue Format überführt.
var LEGACY_TEXT_RE = /---\s*BRIEFING\s*---([\s\S]*?)---\s*ENDE\s*---/i;
// Im HTML-Body: vom Startmarker bis Endmarker inkl. Hinweistext dahinter,
// aber ohne umschließende Tags — so bleibt die Formatierung (div) erhalten.
var LEGACY_HTML_RE = /---\s*BRIEFING\s*---[\s\S]*?---\s*ENDE\s*---[^<]*/i;
// Neues Format im HTML-Body: erste Kunde-Zeile bis Ende der Hinweise-Zeile (Thema dazwischen
// als Plausibilitätsprüfung, damit nicht irgendein "Kunde:" im Freitext greift).
var BLOCK_HTML_RE = /Kunde(?:ninfo)?\s*:[\s\S]*?(?:Thema|Terminart)\s*:[\s\S]*?Hinweise?\s*:[^<]*/i;

// Feld-Beschriftungen wie in briefing.py (FIELDS), inkl. erkannter Varianten
var FIELD_LABELS = {
  thema:       ["Thema", "Terminart"],
  produkt:     ["Produkt", "Produkttyp", "Gerät", "Geraet"],
  ware:        ["Ware", "Warenstatus", "Warenlager"],
  kaufdatum:   ["Kaufdatum"],
  seriennummer: ["Seriennummer", "Seriennr", "SN", "S/N"],
  werkzeug:    ["Werkzeug"],
  zubehoer:    ["Zubehör", "Zubehoer", "Zubehör vor Ort"],
  zahlung:     ["Zahlung", "Bezahlung"],
  kunde:       ["Kunde", "Kundeninfo"],
  hinweise:    ["Hinweise", "Hinweis"],
};
// Reihenfolge im Textblock: Kunde zuerst (Wunsch-Reihenfolge im Formular), dann
// Thema/Produkt/Ware, dann Packlisten, dann restliche Infos.
var FIELD_ORDER = ["kunde", "thema", "produkt", "ware", "kaufdatum", "seriennummer",
  "werkzeug", "zubehoer", "zahlung", "hinweise"];
var FIELD_NAME = { kunde: "Kunde", thema: "Thema", produkt: "Produkt", ware: "Ware",
  kaufdatum: "Kaufdatum", seriennummer: "Seriennummer", werkzeug: "Werkzeug",
  zubehoer: "Zubehör", zahlung: "Zahlung", hinweise: "Hinweise" };

var EMPTY_VALUES = ["", "keine", "keins", "keiner", "nichts", "-", "—", "n/a", "nein"];

function isEmptyValue(s) { return EMPTY_VALUES.indexOf((s || "").trim().toLowerCase()) >= 0; }

function splitItems(raw) {
  raw = (raw || "").trim();
  if (isEmptyValue(raw)) return [];
  var sep = raw.indexOf(";") >= 0 ? ";" : ",";
  return raw.split(sep).map(function (s) { return s.trim(); }).filter(Boolean);
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// "Kunde: Müller" -> {key: "kunde", value: "Müller"}; keine bekannte Feldzeile -> null
function fieldLine(line) {
  var lm = /^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß /]*?)\s*:\s*(.*)$/.exec(line);
  if (!lm) return null;
  var name = lm[1].trim().toLowerCase();
  var key = Object.keys(FIELD_LABELS).find(function (k) {
    return FIELD_LABELS[k].some(function (lab) { return lab.toLowerCase() === name; });
  });
  return key ? { key: key, value: lm[2].trim() } : null;
}

// Zeilen des Blocks finden: Altbestand zwischen den Markern, sonst ab der ersten
// Kunde-Zeile bis einschließlich der ersten Hinweise-Zeile danach (fehlt sie: bis Textende).
function blockLines(bodyText) {
  var m = LEGACY_TEXT_RE.exec(bodyText || "");
  if (m) return m[1].split(/\r?\n/);
  var lines = (bodyText || "").split(/\r?\n/);
  var start = lines.findIndex(function (l) { var f = fieldLine(l); return f && f.key === "kunde"; });
  if (start < 0) return null;
  var end = lines.length - 1;
  for (var i = start + 1; i < lines.length; i++) {
    var f = fieldLine(lines[i]);
    if (f && f.key === "hinweise") { end = i; break; }
  }
  return lines.slice(start, end + 1);
}

// Rohe Feldwerte aus dem Body-Text lesen: { found: bool, fields: {key: "roher Wert"} }
function parseBlockText(bodyText) {
  var res = { found: false, fields: {} };
  var lines = blockLines(bodyText);
  if (!lines) return res;
  res.found = true;
  lines.forEach(function (line) {
    var f = fieldLine(line);
    if (f) res.fields[f.key] = f.value;
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
  var st = { art: "", merkmale: [], produktMerkmale: [], tel: "", mail: "", sonstiges: "" };
  var rest = [];
  splitItems(raw).forEach(function (tok) {
    var artHit = opts.kundeArt.find(function (a) { return a.toLowerCase() === tok.toLowerCase(); });
    if (artHit) { st.art = artHit; return; }
    var mHit = opts.kundeMerkmale.find(function (a) { return a.toLowerCase() === tok.toLowerCase(); });
    if (mHit) { st.merkmale.push(mHit); return; }
    // Altbestand: Wertgarantie stand früher in der Kunde-Zeile -> zum Produkt umziehen
    var pmHit = (opts.produktMerkmale || []).find(function (a) { return a.toLowerCase() === tok.toLowerCase(); });
    if (pmHit) { st.produktMerkmale.push(pmHit); return; }
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

// Thema-Rohwert auf eine bekannte Option abbilden (sonst Rohwert behalten)
function themaFromRaw(raw, themen) {
  raw = (raw || "").trim();
  if (isEmptyValue(raw)) return "";
  var hit = (themen || []).find(function (t) { return t.toLowerCase() === raw.toLowerCase(); });
  return hit || raw;
}

// Sichtbare Vorauswahlen eines Feldes je nach Thema (themenFilter in options.js).
// Angehakte Optionen bleiben immer sichtbar, damit beim Themawechsel nichts verloren geht.
function visibleOptions(field, allOptions, thema, checkedNow, filters) {
  var f = filters ? filters[thema] : null;
  var allowed = (f && f[field] !== undefined) ? f[field] : null;
  if (allowed === null) return allOptions.slice();
  return allOptions.filter(function (o) {
    return allowed.indexOf(o) >= 0 || (checkedNow || []).indexOf(o) >= 0;
  });
}

// Ist ein bedingtes Feld beim aktuellen Thema sichtbar? (feldSichtbarBeiThema in options.js)
// Feld dort nicht gelistet -> immer sichtbar. Ohne BRIEFING_OPTIONS (Node-Test) -> sichtbar.
function fieldVisibleForThema(field, thema) {
  if (typeof BRIEFING_OPTIONS === "undefined") return true;
  var map = BRIEFING_OPTIONS.feldSichtbarBeiThema || {};
  var allowed = map[field];
  if (allowed === undefined) return true;
  return allowed.indexOf(thema) >= 0;
}

// Produkt-Merkmale, die beim aktuellen Thema NICHT ausgeblendet sind (merkmalVerstecktBeiThema)
function merkmaleVisibleForThema(merkmale, thema) {
  if (typeof BRIEFING_OPTIONS === "undefined") return (merkmale || []).slice();
  var hide = BRIEFING_OPTIONS.merkmalVerstecktBeiThema || {};
  return (merkmale || []).filter(function (m) { return (hide[m] || []).indexOf(thema) < 0; });
}

// "Produkt: TV: Loewe stellar 55; Wertgarantie" -> {checked, details, merkmale, sonstiges}
function produktState(raw, typen, merkmale) {
  var st = { checked: [], details: {}, merkmale: [], sonstiges: "" };
  if (!raw || isEmptyValue(raw)) return st;
  var rest = [];
  raw.split(";").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (tok) {
    var m = /^([^:]+?)\s*(?::\s*(.*))?$/.exec(tok);
    var name = m ? m[1].trim() : tok;
    var hit = (typen || []).find(function (t) { return t.toLowerCase() === name.toLowerCase(); });
    if (hit) {
      st.checked.push(hit);
      if (m && m[2]) st.details[hit] = m[2].trim();
      return;
    }
    var mkHit = (merkmale || []).find(function (t) { return t.toLowerCase() === tok.toLowerCase(); });
    if (mkHit) {
      st.merkmale.push(mkHit);
      return;
    }
    rest.push(tok); // unbekannter Eintrag -> Sonstiges (geht nicht verloren)
  });
  st.sonstiges = rest.join("; ");
  return st;
}

function produktValue(st, typen) {
  var parts = [];
  (typen || []).forEach(function (t) {
    if (st.checked.indexOf(t) >= 0) {
      parts.push(st.details[t] ? t + ": " + st.details[t] : t);
    }
  });
  (st.merkmale || []).forEach(function (m) { parts.push(m); });
  if (st.sonstiges) parts.push(flat(st.sonstiges));
  return parts.join("; ");
}

// Kurzform für die Speicherung: "Ware noch im Lager" -> "noch im Lager"
function warenShort(label) { return (label || "").replace(/^Ware\s+/i, "").trim(); }

// "Ware:"-Zeile -> {status, detail}. Gespeichert z. B. "noch im Lager" oder
// "teilweise beim Kunden — Fernbedienung fehlt".
function warenState(raw, opts) {
  var st = { status: "", detail: "" };
  if (!raw || isEmptyValue(raw)) return st;
  var parts = raw.split(" — ");
  var base = parts[0].trim();
  var detail = parts.slice(1).join(" — ").trim();
  var hit = (opts.warenStatus || []).find(function (o) {
    return warenShort(o).toLowerCase() === base.toLowerCase();
  });
  if (hit) {
    st.status = hit;
    if (hit === opts.warenDetailOption) st.detail = detail;
  }
  return st;
}

function warenValue(st, opts) {
  if (!st || !st.status) return "";
  var base = warenShort(st.status);
  if (opts && st.status === opts.warenDetailOption && st.detail) base += " — " + st.detail;
  return base;
}

// Body-Text -> kompletter Formular-Zustand
function stateFromBody(bodyText, opts) {
  var parsed = parseBlockText(bodyText);
  var f = parsed.fields;
  var kunde = kundeState(f.kunde, opts);
  var produkt = produktState(f.produkt, opts.produktTypen, opts.produktMerkmale);
  // Migration: Produkt-Merkmale (Wertgarantie) aus alter Kunde-Zeile übernehmen
  kunde.produktMerkmale.forEach(function (m) {
    if (produkt.merkmale.indexOf(m) < 0) produkt.merkmale.push(m);
  });
  return {
    found: parsed.found,
    thema: themaFromRaw(f.thema, opts.themen),
    produkt: produkt,
    ware: warenState(f.ware, opts),
    kaufdatum: (f.kaufdatum && !isEmptyValue(f.kaufdatum)) ? f.kaufdatum : "",
    seriennummer: (f.seriennummer && !isEmptyValue(f.seriennummer)) ? f.seriennummer : "",
    werkzeug: packState(f.werkzeug, opts.werkzeug),
    zubehoer: packState(f.zubehoer, opts.zubehoer),
    zahlung: zahlungState(f.zahlung, opts.zahlung),
    kunde: kunde,
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
  var opts = (typeof BRIEFING_OPTIONS !== "undefined") ? BRIEFING_OPTIONS : null;
  var thema = (st.thema || "").trim();
  var showKauf = fieldVisibleForThema("kaufSerie", thema);
  // Beim aktuellen Thema unpassende Produkt-Merkmale (z. B. Wertgarantie) nicht speichern.
  var prodOut = { checked: st.produkt.checked, details: st.produkt.details,
    merkmale: merkmaleVisibleForThema(st.produkt.merkmale, thema), sonstiges: st.produkt.sonstiges };
  return {
    thema: thema,
    produkt: produktValue(prodOut, (opts ? opts.produktTypen : null) || st.produkt.checked),
    ware: fieldVisibleForThema("ware", thema) ? warenValue(st.ware, opts) : "",
    kaufdatum: showKauf ? flat(st.kaufdatum) : "",
    seriennummer: showKauf ? flat(st.seriennummer) : "",
    werkzeug: packValue(st.werkzeug),
    zubehoer: packValue(st.zubehoer),
    zahlung: zahlungValue(st.zahlung),
    kunde: kundeValue(st.kunde),
    hinweise: hinweiseValue(st.hinweise),
  };
}

// Blocktext bauen — Format identisch zu commands.js und prefill.py (Leerzeile zwischen
// Feldern, keine Kopf-/Fußzeile)
function buildBlockLines(values) {
  var lines = [];
  FIELD_ORDER.forEach(function (key, i) {
    lines.push(FIELD_NAME[key] + ": " + (values[key] || ""));
    if (i < FIELD_ORDER.length - 1) lines.push("");
  });
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

// Optionale Mehrfachauswahl -> grüner "Chip" (class row check), hebt sich von Radios ab
function checkboxRow(name, value, checked) {
  var id = name + "_" + value.replace(/\W+/g, "_");
  return '<label class="row check"><input type="checkbox" id="' + id + '" data-group="' + name +
    '" value="' + value + '"' + (checked ? " checked" : "") + "> " + value + "</label>";
}

// Genau-eine-Auswahl -> Listenzeile (class row radio)
function radioRow(name, value, checked) {
  var id = name + "_" + value.replace(/\W+/g, "_");
  return '<label class="row radio"><input type="radio" id="' + id + '" name="' + name +
    '" value="' + value + '"' + (checked ? " checked" : "") + "> " + value + "</label>";
}

function escapeAttr(s) { return escapeHtml(s || "").replace(/"/g, "&quot;"); }

function produktIds(typ) {
  var slug = typ.replace(/\W+/g, "_");
  return { box: "produkt_" + slug, detail: "produktdetail_" + slug };
}

// Zeile: Checkbox (Typ) + Inline-Textfeld fürs genaue Produkt (optional)
function produktRow(typ, checked, detail) {
  var ids = produktIds(typ);
  return '<div class="prow">'
    + '<label><input type="checkbox" id="' + ids.box + '" value="' + typ + '"'
    + (checked ? " checked" : "") + "> " + typ + "</label>"
    + '<input type="text" id="' + ids.detail + '" data-typ="' + escapeAttr(typ)
    + '" value="' + escapeAttr(detail) + '" placeholder="optional: genaues Produkt">'
    + "</div>";
}

function warenIds(status) { return "warenstatus_" + status.replace(/\W+/g, "_"); }

// Warenstatus als Radio; die Detail-Option bekommt ein "was fehlt?"-Feld daneben
function warenRow(status, checked, detail, withDetail) {
  var radio = '<label class="row radio"><input type="radio" name="warenstatus" id="'
    + warenIds(status) + '" value="' + escapeAttr(status) + '"' + (checked ? " checked" : "")
    + "> " + status + "</label>";
  if (!withDetail) return radio;
  return '<div class="prow">' + radio
    + '<input type="text" id="f_ware_detail" value="' + escapeAttr(detail)
    + '" placeholder="was fehlt?"></div>';
}

// Warenstatus je Thema vorbelegen — nur, wenn noch nichts gewählt ist
function applyWareDefault(thema) {
  if (radioValue("warenstatus")) return;
  var def = (BRIEFING_OPTIONS.warenDefaultByThema || {})[thema];
  if (def) { var el = $(warenIds(def)); if (el) el.checked = true; }
}

// Eine Packlisten-Gruppe (Werkzeug/Zubehör) themenabhängig gefiltert zeichnen
function renderPackGroup(field, containerId, allOptions, checked, thema) {
  var vis = visibleOptions(field, allOptions, thema, checked, BRIEFING_OPTIONS.themenFilter);
  $(containerId).innerHTML = vis.map(function (o) {
    return checkboxRow(field, o, checked.indexOf(o) >= 0);
  }).join("");
}

// Aktuell gewähltes Thema (Radio; unbekannter Altwert aus dem Block als Fallback)
function currentThema() {
  return radioValue("thema") || $("g_thema").dataset.raw || "";
}

// Container per display ein-/ausblenden (Werte bleiben erhalten, nur unsichtbar)
function toggleSection(id, show) { var el = $(id); if (el) el.style.display = show ? "" : "none"; }

// Produkt-Merkmale themenabhängig zeichnen (unpassende ausblenden, z. B. Wertgarantie)
function renderMerkmale(thema, checked) {
  var vis = merkmaleVisibleForThema(BRIEFING_OPTIONS.produktMerkmale || [], thema);
  $("g_produkt_merkmale").innerHTML = vis.map(function (o) {
    return checkboxRow("produktMerkmale", o, (checked || []).indexOf(o) >= 0);
  }).join("");
}

// Bedingte Bereiche (Ware, Kaufdatum/Seriennummer, Merkmale) je Thema ein-/ausblenden
function applyThemaVisibility(thema) {
  toggleSection("sec_ware", fieldVisibleForThema("ware", thema));
  toggleSection("sec_kaufserie", fieldVisibleForThema("kaufSerie", thema));
  renderMerkmale(thema, checkedValues("produktMerkmale"));
}

// Beim Themawechsel: Häkchen aus dem DOM retten, Gruppen neu (gefiltert) zeichnen
function applyThemaFilter() {
  var thema = currentThema();
  renderPackGroup("werkzeug", "g_werkzeug", BRIEFING_OPTIONS.werkzeug, checkedValues("werkzeug"), thema);
  renderPackGroup("zubehoer", "g_zubehoer", BRIEFING_OPTIONS.zubehoer, checkedValues("zubehoer"), thema);
  applyThemaVisibility(thema);
  applyWareDefault(thema);  // z. B. Neulieferung -> "Ware noch im Lager" vorwählen
}

function renderForm(st, opts) {
  $("g_thema").innerHTML = (opts.themen || []).map(function (o) {
    return radioRow("thema", o, st.thema === o);
  }).join("");
  // Unbekannter Altwert (z. B. von Hand getippt): merken, damit er beim Speichern
  // erhalten bleibt, solange niemand aktiv ein anderes Thema wählt.
  $("g_thema").dataset.raw = (opts.themen || []).indexOf(st.thema) >= 0 ? "" : (st.thema || "");

  $("g_produkt").innerHTML = (opts.produktTypen || []).map(function (t) {
    return produktRow(t, st.produkt.checked.indexOf(t) >= 0, st.produkt.details[t] || "");
  }).join("");
  renderMerkmale(st.thema, st.produkt.merkmale);
  $("g_warenstatus").innerHTML = (opts.warenStatus || []).map(function (o) {
    return warenRow(o, st.ware.status === o, st.ware.detail, o === opts.warenDetailOption);
  }).join("");
  applyWareDefault(st.thema);  // Neulieferung ohne gespeicherten Status -> Vorbelegung
  $("f_kaufdatum").value = st.kaufdatum;
  $("f_seriennummer").value = st.seriennummer;
  $("s_produkt").value = st.produkt.sonstiges;

  renderPackGroup("werkzeug", "g_werkzeug", opts.werkzeug, st.werkzeug.checked, st.thema);
  $("s_werkzeug").value = st.werkzeug.sonstiges;
  $("k_werkzeug").checked = st.werkzeug.keine;

  renderPackGroup("zubehoer", "g_zubehoer", opts.zubehoer, st.zubehoer.checked, st.thema);
  $("s_zubehoer").value = st.zubehoer.sonstiges;
  $("k_zubehoer").checked = st.zubehoer.keine;

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

  // Bedingte Bereiche (Ware nur bei Neulieferung, Kaufdatum/Seriennummer nur bei
  // Service/Reparatur) passend zum geladenen Thema ein-/ausblenden.
  toggleSection("sec_ware", fieldVisibleForThema("ware", st.thema));
  toggleSection("sec_kaufserie", fieldVisibleForThema("kaufSerie", st.thema));
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

function readProdukt() {
  var st = { checked: [], details: {}, merkmale: checkedValues("produktMerkmale"),
    sonstiges: $("s_produkt").value };
  (BRIEFING_OPTIONS.produktTypen || []).forEach(function (t) {
    var ids = produktIds(t);
    var box = $(ids.box);
    var detail = ($(ids.detail) ? $(ids.detail).value : "").trim();
    // Text eingetragen zählt wie angehakt — niemand soll Tipparbeit verlieren
    if ((box && box.checked) || detail) {
      st.checked.push(t);
      if (detail) st.details[t] = detail;
    }
  });
  return st;
}

function readWare() {
  var status = radioValue("warenstatus");
  var detail = $("f_ware_detail") ? $("f_ware_detail").value.trim() : "";
  return { status: status, detail: (status === BRIEFING_OPTIONS.warenDetailOption ? detail : "") };
}

function readForm() {
  return {
    thema: currentThema(),
    produkt: readProdukt(),
    ware: readWare(),
    kaufdatum: $("f_kaufdatum").value,
    seriennummer: $("f_seriennummer").value,
    werkzeug: { keine: $("k_werkzeug").checked, checked: checkedValues("werkzeug"), sonstiges: $("s_werkzeug").value },
    zubehoer: { keine: $("k_zubehoer").checked, checked: checkedValues("zubehoer"), sonstiges: $("s_zubehoer").value },
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
    // vorhandenen Block ersetzen (Formatierung/Umgebung bleibt stehen); Altbestand mit
    // Markern zuerst, damit dessen Kopf-/Fußzeile dabei mit verschwindet
    var re = LEGACY_HTML_RE.test(html) ? LEGACY_HTML_RE : (BLOCK_HTML_RE.test(html) ? BLOCK_HTML_RE : null);
    if (re) {
      var neu = html.replace(re, blockInnerHtml(values));
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
    // Themawechsel filtert die Vorauswahlen live (Delegation: Container bleibt bestehen)
    $("g_thema").addEventListener("change", applyThemaFilter);
    // Tippen im Produkt-Detail hakt den Typ automatisch an
    $("g_produkt").addEventListener("input", function (e) {
      var typ = e.target && e.target.getAttribute && e.target.getAttribute("data-typ");
      if (typ && e.target.value.trim()) {
        var box = $(produktIds(typ).box);
        if (box) box.checked = true;
      }
    });
    // Tippen ins "was fehlt?"-Feld wählt automatisch "teilweise beim Kunden"
    $("g_warenstatus").addEventListener("input", function (e) {
      if (e.target && e.target.id === "f_ware_detail" && e.target.value.trim()) {
        var el = $(warenIds(BRIEFING_OPTIONS.warenDetailOption));
        if (el) el.checked = true;
      }
    });
    // Angeheftetes Taskpane (📌): beim Wechsel auf einen anderen Termin neu laden,
    // sonst zeigt das Formular die Werte des vorherigen Termins.
    if (Office.context && Office.context.mailbox && Office.context.mailbox.addHandlerAsync) {
      Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, function () {
        setStatus("", true);
        loadFromItem();
      });
    }
  });
}

/* Export für den Node-Roundtrip-Test (im Browser wirkungslos) */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseBlockText: parseBlockText, stateFromBody: stateFromBody,
    valuesFromState: valuesFromState, buildBlockLines: buildBlockLines,
    blockFullHtml: blockFullHtml, zahlungState: zahlungState,
    visibleOptions: visibleOptions, themaFromRaw: themaFromRaw,
    produktState: produktState, produktValue: produktValue,
    warenState: warenState, warenValue: warenValue,
    fieldVisibleForThema: fieldVisibleForThema,
    merkmaleVisibleForThema: merkmaleVisibleForThema };
}
