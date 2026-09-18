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
> `CLAUDE.md`, „Never commit secrets".

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

Gepflegt sind **alle neun** Codes des Mappings; `de-DE` ist die Quelle.
Ein Fallback auf die Default-Sprache passiert damit nur noch für Sprachen,
die die App selbst nicht spricht. Mehr Play-Locales gehen erst, wenn die App
eine neue Sprache bekommt — das Mapping ist per Test an `web/project.json`
gebunden.

### Was die neun Sprachen kosten

Store-Texte laufen **nicht** über die tägliche Übersetzungs-Routine (die
arbeitet auf XLIFF und `content/`). Jede Sprache ist damit Handarbeit bei
**jeder** Textänderung: neun Dateien statt einer, und die Limits gelten pro
Sprache einzeln. Wer einen Satz ergänzt, ergänzt ihn neunmal — oder lässt
acht Sprachen veralten, was schlimmer ist als ein englisches Fallback.

Der pragmatische Weg bei einer inhaltlichen Änderung: `de-DE` zuerst
schreiben, dann die übrigen acht nachziehen, dann `pnpm nx test tools`.

Was die einzelnen Sprachen wert sind, unterscheidet sich stark:

- **`en-US` ist Pflicht**, weil Play für jede Sprache ohne eigenes Listing
  auf die Default-Sprache zurückfällt. Ohne sie sieht die halbe Welt
  deutschen Fließtext.
- **`fr-FR`, `es-ES`, `it-IT`** sind große Märkte, in denen ein englisches
  Fallback-Listing spürbar Installs kostet.
- **`nl-NL`, `no-NO`** lesen das englische Listing reibungslos, `el-GR` ist
  ein kleiner Markt — ihr Listing schadet nicht, trägt aber wenig.
- **`zh-CN` erreicht Festlandchina nicht**: Google Play gibt es dort nicht.
  Das Listing bedient Geräte mit chinesischer Sprache außerhalb — für
  Taiwan oder Hongkong bräuchte es `zh-TW` / `zh-HK`, und die stehen
  bewusst nicht im Mapping, weil die App-Locale `zh` nicht sagt, welche
  Region gemeint ist.

Belastbar entscheidet das aber nur die Play Console unter **Statistiken →
Nutzer nach Land/Sprache**, nicht diese Liste.

## Screenshots und Feature-Grafik

Die Assets unter `store/graphics/` entstehen aus der **laufenden App** gegen
die lokalen Emulatoren — keine nachgebauten Mockups, keine Produktionsdaten.
Drei Schritte, jeder einzeln wiederholbar:

```bash
nx run data-store:serve                                   # Auth + Firestore + Functions
nx run web:serve:development-emulator                     # App gegen die Emulatoren
node tools/src/store-graphics/seed-demo-data.mjs          # Demo-Konto + Trainingshistorie
node tools/src/store-graphics/capture-screenshots.mjs     # rohe Screens → tmp/store-graphics
node tools/src/store-graphics/compose-graphics.mjs        # Rahmen + Text → store/graphics
```

- **Der Firestore-Emulator braucht Java.** Ohne JRE startet er nicht; eine
  portable reicht (`JAVA_HOME` auf ein entpacktes Temurin-Verzeichnis).
- **Nur Rohdaten werden geseedet.** Streak, Bestenliste und
  Challenge-Fortschritt rechnen die echten Trigger aus — deshalb stimmen die
  Zahlen in den Screenshots mit dem überein, was die App produziert.
- **Die Übungs-IDs im Seed müssen im `EXERCISE_CATALOG` stehen.** Eine
  erfundene ID rendert als roher Schlüssel (`squat.bodyweight` statt
  „Kniebeugen") und sieht im Store wie ein Bug aus.
- **Nur öffentliche Profile stehen auf der Bestenliste**
  (`isPublicProfileLinkAllowed`). Demo-Nutzer ohne `profileVisibility`
  fehlen dort, und die Liste sieht leer aus.
- **Grenzen prüft `pnpm nx test tools`**: Seitenlängen, Seitenverhältnis
  (höchstens 2:1), Anzahl je Sprache und die exakten Maße von
  Feature-Grafik (1024×500) und Icon (512×512).

Hochgeladen wird in der Play Console: **Store-Eintrag → Grafiken**. Die
Bildtexte sind deutsch; für andere Sprachen fällt Play auf die
Default-Sprache zurück, bis dort eigene Assets liegen.

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
- **Grafiken lädt weiterhin die Console hoch.** Das Publish-Script macht
  bewusst nur Text. Erzeugt werden sie aber nicht mehr von Hand — siehe
  „Screenshots und Feature-Grafik" unten.

---

# Die App selbst veröffentlichen (AAB-Upload)

Der Abschnitt oben betrifft nur den **Store-Text**. Das App-Bundle geht einen
eigenen Weg — dieselbe API, dasselbe Dienstkonto, aber andere Rechte und ein
Signaturschlüssel.

| Was                  | Wo                                   |
| -------------------- | ------------------------------------ |
| Build + Upload       | `.github/workflows/play-release.yml` |
| Upload-Script        | `tools/src/publish-play-release.mjs` |
| Gemeinsame API-Teile | `tools/src/play-api.mjs`             |
| Build-Check auf PRs  | `.github/workflows/android-twa.yml`  |

## Wie es läuft

Ein Push auf `main`, der `mobile/android-twa/**` berührt, baut ein signiertes
Bundle und lädt es in den **`internal`**-Track. Der ist in Minuten verfügbar,
durchläuft keine Google-Review und erreicht nur die Tester dieses Tracks.

Genau dort soll es auch landen: R8 läuft im Full Mode, und dessen Fehler
schlagen **zur Laufzeit** zu, nicht beim Bauen. Kein CI-Job der Welt kann
beweisen, dass das Bundle startet — nur ein Gerät.

**Die Promotion von `internal` auf Produktion bleibt Handarbeit** in der Play
Console. Für den seltenen Fall, dass ein anderer Track direkt bedient werden
soll, gibt es `workflow_dispatch` mit Track-Auswahl und einem
„Upload for real"-Haken, der ohne Ankreuzen nur einen Dry-Run macht.

## versionCode

Kommt aus `git rev-list --count HEAD`, gesetzt über die Umgebungsvariable
`ANDROID_VERSION_CODE`. Play lehnt jeden versionCode ab, den es schon gesehen
hat, und ein vergessener Bump von Hand fällt erst beim Upload auf — nach dem
Build, nach dem Signieren.

Der **versionName** läuft bewusst mit: Er zeigt denselben Wert, wie schon bei
den Versionen 3 und 4. Play erzwingt Eindeutigkeit nur auf dem versionCode, der
Name ist frei — aber ein fester Name würde bedeuten, dass zwei verschiedene
Bundles im Internal-Track gleich heißen und die Tester sie nicht
auseinanderhalten können.

Ein lokaler Build ohne die Variable fällt auf den Wert in `app/build.gradle`
zurück und bleibt unsigniert. Er taugt damit als Build-Beweis, nicht als
Upload-Kandidat. Das ist Absicht.

> Der erste automatische Upload springt von versionCode 4 auf die aktuelle
> Commit-Zahl (vierstellig). Das ist erlaubt — die Obergrenze liegt bei
> 2.100.000.000 — und passiert genau einmal.

## Einrichtung

### 1. Dienstkonto-Rechte erweitern

Das Konto aus Schritt 2 oben darf bisher nur den Store-Eintrag bearbeiten.
Play Console → **Nutzer und Berechtigungen** → das Dienstkonto → **App-Berechtigungen**
für `com.pushupstats.app` zusätzlich:

- **„App-Bundles und APKs hochladen"** (_Upload app bundles and APKs_)
- **„Versionen für Testtracks verwalten"** (_Manage testing track releases_)

Produktionsrechte braucht es **nicht** — der Workflow schreibt nur in
`internal`, und die Promotion passiert per Hand. Wer den Dispatch auch für
`production` nutzen will, muss zusätzlich „Produktionsversionen verwalten"
vergeben; das ist eine bewusste Entscheidung, keine Voraussetzung.

> Rechte propagieren verzögert. Ein `403` beim ersten Lauf heißt meistens
> nicht, dass etwas falsch konfiguriert ist — später nochmal.

### 2. Upload-Keystore als Secrets hinterlegen

Der Keystore signiert das Bundle, damit Play es der bestehenden Listung
zuordnet. **Ohne ihn ist kein Update möglich** — Play App Signing verwaltet
nur den finalen Signaturschlüssel, nicht den Upload-Key.

Prüfen, ob eine gefundene Datei die richtige ist:

```bash
keytool -list -v -keystore <datei> | grep -A1 SHA256
```

Der SHA-256 muss dem `Upload Key`-Fingerprint in
`mobile/android-twa/twa-manifest.json` entsprechen. Tut er das nicht, führt
der Weg über **Play Console → App-Integrität → App-Signatur → Upload-Key
zurücksetzen** (Google schaltet den neuen Key in 1–2 Werktagen frei).

#### Wenn der Upload-Key weg ist

Kein Totalschaden, solange **Play App Signing** aktiv ist — und das ist es hier
(`twa-manifest.json` führt zwei Fingerprints: `Upload Key` und
`Play App Signing`). Der Schlüssel, gegen den die Geräte der Nutzer die App
verifizieren, liegt bei Google und ändert sich nie. Der Upload-Key ist nur die
Tür zum Hochladen, und die lässt sich neu einsetzen.

Neuen Schlüssel erzeugen — **selbst ausführen und sofort in den
Passwortmanager legen**, samt Passwort und Alias:

```bash
keytool -genkeypair -v \
  -keystore upload.keystore -storetype PKCS12 \
  -alias android -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Pushup Tracker, O=Wolfram Sokollek, C=DE"
```

Dann das Zertifikat exportieren:

```bash
keytool -export -rfc -alias android -keystore upload.keystore -file upload_certificate.pem
```

Play Console → **App-Integrität → App-Signatur → Upload-Schlüssel zurücksetzen**
→ `upload_certificate.pem` hochladen. Google schaltet den neuen Schlüssel in
1–2 Werktagen frei; bis dahin lehnt der Upload weiterhin ab. Danach die vier
Secrets unten mit den neuen Werten füllen.

Die App behält ihre Identität, ihre Bewertungen und ihre Installationen — für
die Nutzer ändert sich nichts.

Dann vier Secrets unter **Settings → Secrets and variables → Actions**:

| Secret                      | Inhalt                                             |
| --------------------------- | -------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 < android.keystore` — die ganze Zeile  |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore-Passwort                                  |
| `ANDROID_KEY_ALIAS`         | Alias im Keystore (bei Bubblewrap meist `android`) |
| `ANDROID_KEY_PASSWORD`      | Passwort des Schlüssels (oft identisch)            |

Die Keystore-Datei selbst gehört **nicht** ins Repo — `.gitignore` sperrt
`*.keystore` und `*.jks` bereits. Im Workflow landet sie unter `$RUNNER_TEMP`,
außerhalb des Workspace, und wird in einem `if: always()`-Schritt wieder
gelöscht.

### 3. Erster Lauf als Dry-Run

Actions → **Play Release** → **Run workflow**, „Upload for real" **nicht**
ankreuzen. Der Lauf baut und signiert vollständig und bricht vor dem Upload
ab. Sieht das gut aus, denselben Workflow mit Haken starten — oder einfach
die nächste Wrapper-Änderung nach `main` schieben.

## Gotchas (Release)

- **Ein Bundle pro versionCode.** Ein erneuter Lauf auf demselben Commit
  erzeugt denselben versionCode und wird von Play abgelehnt. Das ist kein
  Bug: derselbe Code soll nicht zweimal unterschiedlich hochgeladen werden.
- **`fetch-depth: 0` ist Pflicht.** Ein flacher Clone zählt weniger Commits
  und erzeugt einen _niedrigeren_ versionCode als der letzte Upload.
- **Der Track-Aufruf ist ein Vollersatz.** `edits.tracks.update` ersetzt die
  Release-Liste des Tracks. Das Script schreibt genau einen Release mit genau
  einem versionCode — ein gestaffelter Rollout müsste hier erweitert werden.
- **Release-Notes fehlen noch.** Play akzeptiert Releases ohne Notizen; die
  Tester sehen dann nur die Versionsnummer. Sinnvolle Erweiterung wäre eine
  `release-notes.txt` je Locale unter `store/play/`, die dann auch die
  Übersetzungs-Routine mitnehmen könnte.
