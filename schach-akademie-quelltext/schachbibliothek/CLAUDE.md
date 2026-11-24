# Schachbibliothek in die App integrieren

Dieses Paket enthält Eröffnungsdaten von Lichess und deutschsprachige, eigens für die App geschriebene Lektionen. Es ist unabhängig vom Framework.

## Dateien

| Datei | Inhalt |
|---|---|
| `manifest.json` | Schemaversion, Quellrevision, Lizenz und Anzahl der Einträge |
| `eroeffnungen.json` | Vollständiger Stand der fünf Lichess-ECO-Dateien A bis E als JSON |
| `lektionen.json` | Deutschsprachige Lektionen zu Eröffnungen, Gambits, Fallen, Taktik, Strategie und Endspiel |
| `lektionen.pgn` | Dieselben Lektionen für PGN-Import und Importtests |
| `LICHESS-CC0.txt` | Lizenztext der Lichess-Eröffnungsdaten |

## Arbeitsauftrag für Claude Code

1. Ermittle die vorhandene Datenhaltung, das Brett und die Schachregel-Bibliothek im App-Projekt. Nutze diese Bausteine für den Import und das Nachspielen.
2. Importiere beide JSON-Dateien getrennt. Prüfe `schemaVersion` sowie die Eintragszahlen aus dem Manifest. Importiere dieselbe Revision wiederholbar ohne doppelte Datensätze. Die Eröffnungs-IDs sind innerhalb der gebündelten Revision eindeutig. Beim Wechsel der Revision können Zeilennummern und IDs wechseln.
3. Biete Suche nach Name und ECO sowie Filter für Gambits an. Suche bei den Lektionen auch nach deutschem Titel und Kategorie. Die englischen Lichess-Namen bleiben im Datensatz erhalten.
4. Öffne Eröffnungen in der Standardstellung und Lektionen mit ihrer `startFen`. Spiele `movesSan` in Reihenfolge ab und biete Vorwärts, Zurück und Neustart an. Erzeuge deutsche Figurenbuchstaben nur in der Anzeige, falls die App diese Darstellung unterstützt.
5. Nutze `positionKey` optional, um Varianten zu gruppieren, die in derselben Brettstellung enden. Erhalte alle Namen und Zugfolgen. Verwende für den Vergleich dieselbe FEN-Normalisierung, insbesondere beim En-passant-Feld.
6. Zeige bei Lektionen Titel und Erklärung. Bei Aufgaben mit einer Lösung erst die Stellung anzeigen und die Beispielzugfolge bei Bedarf aufdecken. Die Zugeingabe und Variantenprüfung bleiben Aufgabe der Regel-Bibliothek.
7. Prüfe mindestens Suche nach Spanisch/Ruy Lopez über die jeweiligen Titel oder Namen, ein Gambit, ein Matt aus der Grundstellung und eine Lektion mit FEN-Start. Prüfe auch den erneuten Import derselben Revision.

## Datenvertrag

- Eröffnung: `id`, `eco`, `name`, `pgn` (Zugtext), `movesSan` (englische SAN), `positionKey` (erste vier FEN-Felder der Endstellung), `isGambit`, `isTrap` (Namensfilter).
- Lektion: `id`, `category`, `title`, `startFen`, `movesSan`, `finalFen`, `note`, `pgn`. Kategorien: `opening`, `gambit`, `trap`, `tactic`, `strategy`, `endgame`.
- Die Namensfilter erkennen englische Schlüsselwörter. Die kuratierten Fallen stehen in den Lektionen unter `trap`.
- Die Lektionen enthalten legale Beispielzüge. Eine Zugfolge ist keine Engine-Empfehlung und bei Übungen können je nach Stellung weitere Lösungen existieren.

## Herkunft

Die Eröffnungsdaten stammen aus [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) unter CC0 1.0. Die genaue Revision steht im Manifest. Die deutschen Lektionstexte und die eigens zusammengestellten Lektionen sind zur freien Nutzung in der App vorgesehen. Fremde PDFs, Aufgabensammlungen und Kommentare aus der Recherche sind nicht enthalten.
