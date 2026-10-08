# Office-Add-in: Vorlage automatisch beim Termin-Anlegen einfügen

Dieses Add-in ergänzt die Briefing-Vorlage **direkt beim Erstellen eines Termins** —
zeichengleich zu dem, was `prefill.py` schreibt. Zwei Bausteine:

1. **Automatisch** — beim Anlegen eines neuen Termins stehen die Feldzeilen (`Kunde:`,
   `Thema:` … `Hinweise:`) von selbst oben im Notizfeld (Ereignis `OnNewAppointmentOrganizer`).
   Man tippt einfach hinter die Doppelpunkte — **ohne Knopf**. Ist schon ein Block da, passiert
   nichts.
2. **Knopf „Briefing ausfüllen"** — öffnet das **Formular** im Seitenfenster (`taskpane.html`):
   Vorauswahlen anklicken statt tippen (Werkzeug-Häkchen, Zahlungsart-Auswahl, Kunden-Merkmale …).
   „Übernehmen" schreibt den Textblock in den Termin; ein vorhandener Block wird dabei
   **ersetzt und vorher eingelesen** — Bearbeiten funktioniert also auch.

Der Termin enthält nur den **Textblock** — so erscheint er auch im gedruckten Tageskalender.
Der Block hat **keine Kopf-/Fußzeile** mehr; erkannt wird er an seinen Feldzeilen (erste
`Kunde:`-Zeile bis `Hinweise:`-Zeile). Alte Termine mit `--- BRIEFING ---`/`--- ENDE ---`
werden weiter gelesen und beim „Übernehmen" ins neue Format überführt.

## Vorauswahl-Optionen ergänzen (z. B. neues Standard-Werkzeug)

Alle Listen stehen in **`options.js`** — bewusst simpel gehalten:
1. Zeile in der passenden Liste ergänzen (z. B. `"Kabeltrommel",` unter `werkzeug`)
2. `git add options.js && git commit -m "Option ergänzt" && git push`
3. Fertig — beim nächsten Öffnen des Formulars überall da. **Kein Admin-Center nötig**,
   da sich nur eine gehostete Datei ändert, nicht das Manifest.

Das gilt genauso für die **Themen** (`themen`), die **Produkttypen** (`produktTypen`,
je Typ mit optionalem Inline-Feld fürs genaue Gerät — gespeichert als
`Produkt: TV: Loewe stellar 55; HiFi`) und die **themenabhängige Filterung**
(`themenFilter`): je Thema steht dort, welche Werkzeug-/Zubehör-Vorauswahlen angezeigt
werden. Thema ohne Eintrag = alles anzeigen; `[]` = keine Vorauswahl (nur Sonstiges).
Bereits angehakte Optionen bleiben immer sichtbar, damit beim Themawechsel nichts
verloren geht. Das gewählte Thema landet als `Thema:`-Zeile im Block.

> **Warum ein Add-in und kein VBA-Makro?** VBA gibt es nur im klassischen Outlook für Windows.
> Das Add-in läuft plattformübergreifend — Windows, **Mac** und Outlook im Browser.

---

## Wichtig vorab: Hosting = eigenes **öffentliches** Repo

Das Add-in besteht aus statischen Web-Dateien (`commands.html`, `commands.js`, `assets/`), die
Outlook per HTTPS lädt. Gehostet wird kostenlos über **GitHub Pages**.

- GitHub Pages baut aus **privaten** Repos nur mit kostenpflichtigem Plan. Darum kommt das Add-in
  in ein **eigenes, öffentliches** Repo `termin-briefing-addin`.
- Das ist unbedenklich: Diese Dateien enthalten **keine Kundendaten und kein Secret** — nur die
  leere Vorlage. Das sensible Tool (`tool/`) bleibt im privaten Repo.

---

## 1. Öffentliches Repo anlegen und Dateien hochladen

Auf dem Mac im Ordner `termin-briefing/addin`:

```bash
cd ~/PhpstormProjects/claude-code/termin-briefing/addin
gh repo create termin-briefing-addin --public \
  --description "Outlook-Add-in: Briefing-Vorlage automatisch einfügen"

git init -b main
git add manifest.xml commands.html commands.js assets/ make-icons.py SETUP-office-addin.md
git commit -m "Termin-Briefing Outlook-Add-in"
git remote add origin https://github.com/axelk-kw/termin-briefing-addin.git
git push -u origin main
```

> Heißt dein GitHub-Konto nicht `axelk-kw`, überall unten anpassen — **und** die fünf URLs in
> `manifest.xml` (Suchen/Ersetzen `axelk-kw.github.io/termin-briefing-addin`).

## 2. GitHub Pages einschalten

Im Browser: `github.com/axelk-kw/termin-briefing-addin` → **Settings → Pages** →
*Build and deployment* → Source **Deploy from a branch** → Branch **main** / **/(root)** → *Save*.

Nach 1–2 Minuten ist die Seite live. Kurz prüfen (muss die Datei anzeigen, nicht 404):

```
https://axelk-kw.github.io/termin-briefing-addin/commands.js
```

## 3. In Microsoft 365 ausrollen (zentral fürs Team)

Als Administrator im **Microsoft 365 Admin Center**:

1. **Einstellungen → Integrierte Apps** → **Benutzerdefinierte App hochladen**.
2. **Manifestdatei (.xml) hochladen** wählen → `manifest.xml` hochladen
   (oder die URL `https://axelk-kw.github.io/termin-briefing-addin/manifest.xml`, falls du sie
   mit hochlädst — Datei-Upload ist am einfachsten).
3. Zuweisen: erst **nur an dich** (Test), später **Gesamte Organisation** bzw. das Team.
4. **Bereitstellen**. Verteilung an alle Postfächer kann bis zu **6 Stunden** dauern.

## 4. Testen (ohne Admin, sofort — „Sideload")

Zum schnellen Ausprobieren am eigenen Postfach, ohne aufs Ausrollen zu warten:

- **Outlook im Browser:** Einstellungen (Zahnrad) → *Add-Ins verwalten* / *Get Add-ins* →
  **Eigene Add-Ins → Benutzerdefiniertes Add-In hinzufügen → Aus Datei** → `manifest.xml`.
- **Outlook Windows/Mac (neu):** *Add-Ins abrufen* → **Meine Add-Ins → Benutzerdefiniertes
  Add-In → Aus Datei**.

Danach einen **neuen Termin** anlegen → der Block sollte oben erscheinen. Erscheint er nicht
automatisch (siehe Hinweise), tut es der Knopf **„Briefing einfügen"** im Termin-Menüband.

---

## Hinweise / Feinheiten

- **Automatisches Einfügen** (Ereignis) läuft am zuverlässigsten in **Outlook für Windows (neu)**
  und **im Browser**. Auf **Mac** kann es je nach Version etwas hinterherhinken — dort ist der
  **Knopf** der sichere Weg. Der Knopf funktioniert überall.
- **Anheften (📌) des Formulars:** wird nicht überall angeboten. Getestet 21.07.2026:
  **Outlook für Mac (neu) zeigt beim Termin-Verfassen keine Nadel** — dort bleibt es bei einem
  Klick auf „Briefing ausfüllen" pro Termin. Windows/Web je nach Version. Plattform-Grenze,
  kein Fehler; ein sich selbst öffnendes Taskpane sieht Outlook nicht vor.
- **Caching:** Outlook cached Add-in-Code teils zäh. Nach einer Änderung an `commands.js` hilft
  Outlook neu starten bzw. im Browser hart neu laden (Strg/Cmd+Shift+R).
- **Icon ändern:** `assets/`-PNGs ersetzen (Logo) oder `make-icons.py` anpassen und
  `python3 make-icons.py` neu laufen lassen, dann committen + pushen.
- **Zusammenspiel mit dem Tool:** Das Add-in fügt beim **Anlegen** die leere Vorlage ein,
  `prefill.py` tut dasselbe auf dem Mini-PC für alles, was **anders** angelegt wurde (Handy,
  Serien, Importe). Doppelt eingefügt wird nie — beide prüfen erst, ob schon ein Block da ist.
  **Wichtig:** `prefill.py` muss dafür ebenfalls das markerlose Format schreiben **und** erkennen
  (Kunde-Zeile am Zeilenanfang), sonst setzt es zusätzlich einen alten Block mit Markern davor.
  Das Vorabend-Digest ist abgeschaltet; sein Parser erwartet noch die Marker.
- **Radios vs. Chips:** Runde Felder (○) = genau eine Auswahl (Thema, Zahlung, Kunde-Art,
  Warenstatus). Grüne Chips (☑) = optionale Mehrfachauswahl (Werkzeug, Zubehör, Hinweise,
  Kunden-/Produkt-Merkmale). Die „Ware"-Auswahl kann je Thema vorbelegt werden
  (`warenDefaultByThema` in options.js, z. B. Neulieferung → „Ware noch im Lager").
- **Vollvariante:** Das Add-in fügt immer die volle Feldliste ein (inkl. Werkzeug). Beim manuellen
  Anlegen steht die Kategorie meist noch nicht fest; überzählige Zeilen dürfen leer bleiben.
  Die `Kunde:`- und `Hinweise:`-Zeile bitte stehen lassen — daran erkennt das Formular den Block.

## Updates ausrollen — zwei Fälle

- **Nur gehostete Dateien geändert** (`taskpane.html`, `taskpane.js`, `options.js`,
  `commands.js`, Icons): einfach committen + pushen. GitHub Pages aktualisiert in 1–2 Min,
  Outlook zieht die Dateien beim nächsten Öffnen (ggf. Outlook neu starten wegen Cache).
- **`manifest.xml` geändert** (neue Knöpfe, neue Version): zusätzlich im
  **M365 Admin Center → Integrierte Apps → Termin-Briefing → Manifest aktualisieren**
  die neue Datei hochladen. Danach Outlook neu starten.

## Manifest prüfen (bei Änderungen)

```bash
npx --yes office-addin-manifest validate manifest.xml
```
