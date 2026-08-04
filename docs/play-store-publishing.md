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
**nicht** ankreuzen. Sieht der Diff richtig aus, denselben Workflow mit
angekreuztem „Publish for real" nochmal starten.

„Dry-Run" heißt: es wird nichts veröffentlicht. **Read-only ist es trotzdem
nicht** — der Lauf legt einen temporären Play-Edit an, um den Live-Eintrag
zu lesen, und verwirft ihn danach wieder. Er braucht deshalb dieselbe
Berechtigung wie ein echter Publish; ein reines Lese-Recht genügt nicht.

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

Gepflegt sind aktuell **`de-DE`** (Quelle) und **`en-US`**. Die übrigen
Codes stehen im Mapping bereit, haben aber noch kein Listing — Play fällt
für sie auf die Default-Sprache des Store-Eintrags zurück.

### Welche Sprachen sich lohnen

Store-Texte laufen **nicht** über die tägliche Übersetzungs-Routine (die
arbeitet auf XLIFF und `content/`). Jede zusätzliche Sprache ist damit
dauerhafte Handarbeit bei jeder Textänderung — die Frage ist also nicht
„welche können wir", sondern „welche verdienen die Pflege".

- **`en-US` ist Pflicht**, weil Play für jede Sprache ohne eigenes Listing
  auf die Default-Sprache zurückfällt. Ohne sie sieht die halbe Welt
  deutschen Fließtext.
- **`fr-FR`, `es-ES`, `it-IT`** sind die nächsten sinnvollen Kandidaten:
  große Märkte, in denen ein englisches Fallback-Listing spürbar Installs
  kostet.
- **`nl-NL`, `no-NO`** haben sehr hohe Englisch-Kompetenz und lesen das
  englische Listing reibungslos; `el-GR` ist ein kleiner Markt. Alle drei
  eher nachrangig.
- **`zh-CN` ist praktisch wertlos**: Google Play gibt es in Festlandchina
  nicht. Wer chinesische Nutzer erreichen will, braucht `zh-TW` oder
  `zh-HK` — die stehen bewusst nicht im Mapping, weil die App-Locale `zh`
  nicht sagt, welche Region gemeint ist.

Belastbar entscheidet das aber nur die Play Console unter **Statistiken →
Nutzer nach Land/Sprache**, nicht diese Liste.

## Gotchas

- **Review-Queue.** Ein committeter Listing-Text ist nicht sofort live,
  Google prüft ihn. Rollback = alten Text erneut veröffentlichen.
- **Managed Publishing.** Ist das in der Console aktiv, hängt die Änderung
  zusätzlich, bis sie dort freigegeben wird.
- **Offene Edits blockieren.** Bricht ein Lauf mitten in einem Edit ab, kann
  der nächste mit einem Konflikt scheitern. Das Script räumt seinen Edit im
  Fehlerfall selbst ab; bleibt trotzdem einer hängen, in der Console unter
  dem App-Eintrag verwerfen.
- **Emoji kosten mehr als ein Zeichen.** Play zählt UTF-16-Code-Units, nicht
  Glyphen — das Backend ist eine JVM. `📷` kostet 2, `🏋️` sogar 3 (Surrogatpaar
  plus Variation Selector), obwohl beide wie ein Zeichen aussehen. Die
  Beschreibung ist voller Emoji: Codepoint-Zählung lag ~10 Zeichen zu niedrig
  und hätte einen 4004 Zeichen langen Text als „3994" durchgewunken.
  `countCharacters()` zählt deshalb Code-Units.
- **Grafiken bleiben Handarbeit.** Screenshots, Feature-Grafik und Icon
  gehen über diesen Weg nicht mit; die API kann sie zwar, das Script macht
  bewusst nur Text.
