# Schach-Akademie – Übergabe an Claude Code

Stand: 18.11.2026. Besitzer: Ben (iPhone/iPad, nur Windows-Laptop, kein Mac). Sprache der App und aller Texte: Deutsch.

## Was das Projekt ist
Eine Schach-Web-App von Level 0 bis Profi: Partien gegen eine eigene Engine, Lektionen (Eröffnungen, Angriffe, Fallen, Verteidigung, Endspiele), Puzzles, Partieanalyse, Schachuhren, Lehrer-Kommentare mit Sprachausgabe. Die ganze App ist **eine einzige HTML-Datei** (`dist/index.html`, ca. 1 MB). Sie läuft aktuell als claude.ai-Artifact (öffentlich, Slug `39cbcbff-a9ed-4e34-b604-b8fcc3da651d`, URL https://claude.ai/artifact/88wZ7Myzmk8Pj5UNFKoMoJ).

## Technik
- Vanilla JS, Bundle mit esbuild (`node build.mjs` → `dist/index.html`), chess.js (Regeln), three.js 0.187 (Brett), eigene 0x88-Engine im Web Worker (Blob, Fallback im Hauptthread).
- Ordner: `src/` (app.js, board3d.js, boardview.js, board2d.js [nur Fallback], engine*.js, lessons.js, puzzles.json, util.js, style.css, index.template.html, Assets: hand/handshadow/sleeve.webp, knight.svg, `pieces/*.webp` + `meta.json`), `test/` (Playwright-Skripte), `site/` (Variante für eigene Webadresse mit `manifest.webmanifest`, Icons).
- `build.mjs`: Loader `.json`, `.svg` (Text), `.webp` (dataurl); ersetzt `/*ICON*/` im Template durch Icon-Links.
- Artifact-Fähigkeiten `sample` (Tutor-Chat) und `dictation` (Diktat) gibt es nur in claude.ai, nicht auf eigener Adresse.

## Aktueller Funktionsstand
- **Brett:** ausschließlich Draufsicht (Kamera senkrecht von oben). Andere Ansichten und 2D wurden auf Wunsch entfernt. Brett wie auf Bens Foto: cremeweiße/ebenholzschwarze Felder, dunkler Holzrahmen. Figuren sind **Fotos echter Staunton-Figuren** (zwölf ausgeschnittene WebP mit Alpha in `src/pieces/`), als flache Planes auf dem Brett, immer aufrecht zum Spieler (`rotation.y = base.az`). Anordnung nach `meta.json` (Breite/Höhe in Feldeinheiten), Boden der Figur bei z = +0,47.
- **Hand:** Fotohand (Texturen auf Planes, MeshBasicMaterial, depthTest aus, renderOrder 10–13) mit weißem Ärmel. Sie greift die Figur, schiebt sie (Springer/Schlagen mit Bogen), räumt Geschlagenes in die Ablage am Rand, Rochade, Umwandlung, Schach-Puls, Matt-Kippen. Der Arm zielt jedes Frame auf einen Schulterpunkt (`_aimHand`).
- **Ablage geschlagener Figuren:** schmale Spalte links/rechts (x = ±4,62, Abstand 0,48, Maßstab 0,4), nur bei Partien aus der Grundstellung (`showTray`).
- **Kamera:** `_rebase` mit Radius 15,3 (mit Ablage) bzw. 13,7 (ohne), damit das Brett das graue Fenster fast füllt.
- **Look:** helle Oberfläche in hellem Anthrazit, Weiß und Gold; neues Icon `knight.svg` (weißer Springer, goldener Ring).
- **Lektionen:** 83 (`src/lessons.js`, Format `S(id, kategorie, stufe, titel, idee, 'züge', { ask, hint, notes })`). 22 davon neu: Halloween-Gambit (+ Abwehr), Evans-, Königs- (Kieseritzky), Falkbeer-, Wiener, Dänisches, Smith-Morra-, Wolga-, Lettisches Gambit, Skandinavisch, Pirc, Aljechin, Drache, Philidor, Petrow, Vierspringer, Damenindisch, Holländisch, Benoni, Colle, Albin. Validierung: `node test/validate.mjs` (alle Züge legal, 0 Fehler).
- **Lehrer:** schaltbare Kommentare in Partien, optional gesprochen (`coach`, `coachVoice`).
- **Sprache (util.js):** speechSynthesis mit Rangliste deutscher Stimmen, Satz-Chunking, Timeouts; iOS-Freischaltung per erster Berührung (`unlockSpeech`), `speakProbe` testet Stimmen der Reihe nach und fällt auf Systemstandard zurück (`noVoice`, gespeichert in `store`). Der Knopf „Stimme anhören“ in den Einstellungen nutzt es und zeigt bei Fehler ein Hinweisfenster.

## Gelöste Fehler (zur Orientierung)
- Coach hielt die Engine an (`await speak()`), Bot zog bei einer Freundin nicht → Sprache wird nicht mehr abgewartet, 4-s-Rennen mit der Engine.
- Hand sah wie ein starrer Stab aus → Arm zielt auf Schulterpunkt, Ärmelverlängerung.
- Ablage zeigte in Lektionen falsche Figuren → nur in Partien aus der Grundstellung.
- Erster Tipp auf dem Brett wurde verschluckt, wenn noch ein Tween lief (`_down` in boardview.js) → Tween wird übersprungen, Tipp aber ausgewertet.
- Publish-Fehler 422 → bei `publish_files` immer `shared_live: "public"` und `artifact_title` mitgeben, `base_version` = letzte Version.

## Offene Punkte / bekannte Schwächen
1. **Home-Bildschirm-Icon und Vollbild auf iOS** funktionieren nur auf einer eigenen Adresse (im claude.ai-Rahmen nicht). Gewählter Weg: GitHub Pages mit dem Inhalt von `site/` (oder Netlify Drop mit `schach-akademie-website.zip`). Blocker: Bens GitHub ist nicht mit claude.ai verbunden (kein Repo, `list_repos` leer). Danach: Repo `schach-akademie` anlegen, `site/*` pushen, Pages auf `main` aktivieren, in Safari „Zum Home-Bildschirm“.
2. **Stimme klingt mechanisch** (iOS-Standardstimme). Bessere Stimme nur über iOS-Einstellungen (Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch, „Erweitert/Premium“). Innerhalb von claude.ai blockiert iOS die gewählte Stimme offenbar, Standardstimme geht. Auf eigener Adresse vermutlich besser. Keine Cloud-TTS möglich.
3. **Ausschnitte der Figuren** sind an den Rändern nicht ganz sauber (vor allem Krone der weißen Dame, Schwarz-Dame per GrabCut). Skripte dazu lagen nur in `/tmp/spr` (nicht im Repo); Quelle ist Bens Foto. Ggf. neu ausschneiden oder Kanten glätten.
4. **Alte Tests** `test/e2e.mjs`, `e2e2.mjs`, `e2e3.mjs` nutzen DOM-Selektoren `.sq` des früheren 2D-Bretts und sind veraltet. Aktuell gültig: `e2e5.mjs`, `shot.mjs`, `les2.mjs`, `set.mjs`, `hand.mjs`, `validate.mjs`, `icon.mjs`.
5. **Lektionen-Inhalt:** Kommentare zu den 22 neuen Lektionen sind von Claude geschrieben, nur Zuglegalität ist geprüft, Theorie nicht gegen Quellen verifiziert. Prüfen: Dänisches Gambit (Linie endet nach 6…Nf6), Lettisches Gambit, Petrow (Hinweistexte), Drache.
6. **„Höllen-Gambit“** wollte Ben haben; Name konnte nicht eindeutig zugeordnet werden (evtl. Inferno-Gambit oder Fried-Liver-Variante). Nachfragen.
7. **Weitere Wunschideen:** goldene Kontur für weiße Figuren, hellere schwarze Felder, mehr Lektionen/Fallen (Bens Liste fehlt noch), Spielstärken/Engine verbessern.
8. **iOS-Tippen auf dem Brett** nicht auf echtem Gerät getestet (nur Headless-Chrome mit Touch-Emulation). Falls Ben weiter „Figur lässt sich nicht bewegen“ meldet: `BoardView._down`, `_sqAt` (Raycast auf Ebene y=.3) und `movesFrom` in app.js prüfen; Kamera-/Größenänderung (`_rebase`) kann die Trefferfläche verschieben.
9. **Code-Hygiene:** `Board3D` enthält noch ungenutzte Lathe-Geometrien und `matW/matB` aus der alten 3D-Figurenversion (`_buildGeo`, `_mat`); können entfernt werden. `board2d.js` ist nur Fallback ohne WebGL.

## Bens Wünsche und Präferenzen (aus dem Chat)
- Alles auf Deutsch, einfache Sprache; Ben ist kein Programmierer.
- Ansicht: nur Draufsicht mit Hand und Foto-Brett; hell, freundlich, Anthrazit/Weiß/Gold; möglichst großes Brett.
- Stimme: so natürlich wie möglich.
- Erwartung: App soll direkt als Icon auf dem Home-Bildschirm erscheinen und im Vollbild laufen.

## Bauen, testen, veröffentlichen
```
npm install
node build.mjs                 # → dist/index.html (+ dist/icon-*.png)
node test/validate.mjs         # Lektionen prüfen (muss 0 Fehler melden)
node test/e2e5.mjs             # Partie + Lektion im Headless-Chrome
node test/shot.mjs             # Screenshot → /tmp/shot.png
```
Playwright nutzt `/usr/bin/google-chrome` mit `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Für `site/index.html`: `dist/index.html` nehmen und nach dem `apple-touch-icon`-Link `<link rel="manifest" href="manifest.webmanifest">` einfügen, dann ZIP neu packen.

## Bitte von Ben an Code
Gesamten Code prüfen und verbessern: Fehler und Performance auf dem iPhone, Tippen auf dem Brett, Stimme, aufräumen (siehe Punkt 9), alte Tests erneuern, Lektionen fachlich gegenprüfen.
