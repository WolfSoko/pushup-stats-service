# Play-Store-Listing per Code veröffentlichen

Der Store-Text lebt als Quelldateien im Repo und wird über die Google Play
Developer API in die Console geschoben — kein Copy-Paste mehr.

| Was                  | Wo                                                                        |
| -------------------- | ------------------------------------------------------------------------- |
| Quelltexte           | `store/play/<play-locale>/{title,short-description,full-description}.txt` |
| Validierung + Limits | `tools/src/play-listing-source.mjs`                                       |
| Publish-Script       | `tools/src/publish-play-listing.mjs`                                      |
| Manueller Workflow   | `.github/workflows/play-listing.yml`                                      |

## Einmalige Einrichtung

Diese Schritte kann nur jemand mit Zugriff auf Play Console und Google Cloud
machen — sie sind **nicht** automatisierbar.

### 1. Service-Account in Google Cloud anlegen

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt wählen
   (oder ein neues anlegen, z. B. `pushup-stats-play`).
2. **APIs & Dienste → Bibliothek** → „Google Play Android Developer API"
   suchen → **Aktivieren**.
3. **IAM & Verwaltung → Dienstkonten → Dienstkonto erstellen**.
   Name z. B. `play-listing-publisher`. Projekt-Rollen braucht es **keine** —
   die Berechtigung kommt in Schritt 2 aus der Play Console.
4. Beim erstellten Dienstkonto → **Schlüssel → Schlüssel hinzufügen → Neuen
   Schlüssel erstellen → JSON**. Die Datei wird einmalig heruntergeladen.
5. Die E-Mail-Adresse des Dienstkontos kopieren
   (`play-listing-publisher@<projekt>.iam.gserviceaccount.com`).

> Die JSON-Datei ist ein Passwort. Sie gehört **nicht** ins Repo — siehe
> `AGENTS.md`, „Never commit secrets".

### 2. Dienstkonto in der Play Console berechtigen

1. [Play Console](https://play.google.com/console/) → **Nutzer und
   Berechtigungen → Nutzer einladen**.
2. Die Dienstkonto-E-Mail aus Schritt 1.5 eintragen.
3. Unter **App-Berechtigungen** die App `com.pushupstats.app` auswählen.
4. Recht **„Store-Eintrag, Preise und Vertrieb bearbeiten"** setzen
   (englisch: _Edit store listing, pricing & distribution_). Mehr braucht das
   Script nicht — es lädt keine Releases hoch.
5. Einladen.

> **Rechte brauchen Zeit.** Google propagiert neue Dienstkonto-Berechtigungen
> teils mehrere Stunden, in Einzelfällen bis zu 24 h. Wenn der erste Lauf mit
> `403` scheitert, ist meistens nichts falsch konfiguriert — später nochmal.

### 3. Schlüssel als GitHub-Secret hinterlegen

Repo → **Settings → Secrets and variables → Actions → New repository secret**

- **Name:** `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- **Wert:** der **komplette Inhalt** der JSON-Datei aus Schritt 1.4
  (von `{` bis `}`, nicht der Dateipfad)

### 4. Erster Lauf — als Dry-Run

Repo → **Actions → Play Store Listing → Run workflow**, „Publish for real"
**nicht** ankreuzen. Der Lauf liest den Live-Eintrag, zeigt den Diff und
schreibt nichts. Sieht der Diff richtig aus, denselben Workflow mit
angekreuztem „Publish for real" nochmal starten.

## Alltag

Text ändern = die `.txt`-Dateien unter `store/play/` ändern, PR, mergen. Die
Limits (30 / 80 / 4000 Zeichen) prüft `pnpm nx test tools` bei jedem PR mit —
zu langer Text scheitert also in CI und nicht erst beim Publish.

Veröffentlicht wird danach bewusst per Hand über den Workflow.

### Lokal ausführen

```bash
export GOOGLE_PLAY_SERVICE_ACCOUNT_JSON="$(cat ~/pfad/zum/key.json)"

pnpm nx run tools:publish-play-listing                      # Dry-Run, zeigt Diff
pnpm nx run tools:publish-play-listing -- --commit          # veröffentlicht
pnpm nx run tools:publish-play-listing -- --locale=de-DE    # nur eine Sprache
```

## Neue Sprache ergänzen

1. Verzeichnis `store/play/<play-locale>/` anlegen, die drei `.txt`-Dateien
   befüllen.
2. Der Locale-Code muss in `PLAY_LOCALE_BY_APP_LOCALE`
   (`tools/src/play-listing-source.mjs`) stehen — sonst schlägt der Test fehl.
   Play verlangt volle Codes (`de-DE`), nicht die App-Codes (`de`).

Aktuelles Mapping:

| App (`web/project.json`) | Play    |
| ------------------------ | ------- |
| `de`                     | `de-DE` |
| `en`                     | `en-US` |
| `fr`                     | `fr-FR` |
| `es`                     | `es-ES` |
| `it`                     | `it-IT` |
| `nl`                     | `nl-NL` |
| `el`                     | `el-GR` |
| `no`                     | `no-NO` |
| `zh`                     | `zh-CN` |

Ein Test pinnt diese Tabelle an die `localize`-Liste in `web/project.json`:
eine neue App-Sprache ohne Play-Mapping bricht CI.

## Gotchas

- **Review-Queue.** Ein committeter Listing-Text ist nicht sofort live,
  Google prüft ihn. Rollback = alten Text erneut veröffentlichen.
- **Managed Publishing.** Ist das in der Console aktiv, hängt die Änderung
  zusätzlich, bis sie dort freigegeben wird.
- **Offene Edits blockieren.** Bricht ein Lauf mitten in einem Edit ab, kann
  der nächste mit einem Konflikt scheitern. Das Script räumt seinen Edit im
  Fehlerfall selbst ab; bleibt trotzdem einer hängen, in der Console unter
  dem App-Eintrag verwerfen.
- **Emoji zählen als ein Zeichen.** Die Beschreibung ist voller Emoji, und
  `String.length` zählt Surrogatpaare doppelt. `countCharacters()` zählt
  Codepoints — deshalb passt der lokale Check zu dem, was die Console sagt.
- **Grafiken bleiben Handarbeit.** Screenshots, Feature-Grafik und Icon
  gehen über diesen Weg nicht mit; die API kann sie zwar, das Script macht
  bewusst nur Text.
