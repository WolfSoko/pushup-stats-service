# Rebranding-Plan

**Status:** Planung — wartet auf Namensentscheidung (Gate 0)
**Entschiedener Umfang:** Voll — neuer Name, neue Domain, neues Play-Listing
**Erstellt:** 2026-09-20

---

## 1. Warum

Die Marke sagt „Liegestütze". Das Produkt ist längst etwas anderes.

Was heute drinsteckt:

| Bereich           | Umfang                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| Übungskatalog     | 9 Kategorien: `pushup`, `push`, `pull`, `squat`, `hinge`, `lunge`, `core`, `cardio`, `mobility` |
| Übungs-Wiki       | 360 Content-Dateien (`content/wiki/exercises`)                                                  |
| Liegestütz-Wiki   | 117 Content-Dateien (`content/wiki/pushup-types`) — echter Teil-Bereich, kein Markenkern        |
| Trainingspläne    | 6 Pläne, `TrainingPlanDay.exerciseId` über den ganzen Katalog                                   |
| Eigene Sessions   | `/workouts` — frei zusammenstellbare Workouts                                                   |
| Kamera-Autozähler | Reps **und** Halte-Timer (Plank, Hollow-Hold), nicht nur Liegestütze                            |
| Social            | Freunde, Bestenliste, öffentliche Profile, Nachrichten-Inbox, Abzeichen                         |
| Content           | 21 Blog-Artikel in 9 Sprachen (Kniebeugen, Klimmzüge, HIIT/Zone 2, Schlaf, Rumpftraining …)     |
| Weiteres          | KI-Coach, Push-Erinnerungen, Analyse-Views, Heatmap/Streaks                                     |

Der Mismatch wirkt auf drei Ebenen:

1. **Akquise** — Play-Titel „Pushup Tracker: Liegestütze" und Domain `pushup-stats.com` filtern Nutzer weg, die Kniebeugen, Klimmzüge oder Ganzkörpertraining suchen. Die 21 Blog-Artikel ranken teils auf Nicht-Liegestütz-Themen und landen auf einer Marke, die dem Thema widerspricht.
2. **Erwartung** — Wer wegen Liegestützen kommt, findet ein breiteres Produkt vor als beworben. Die Landing-Subtitle zählt bereits „Liegestütze, Kniebeugen, Klimmzüge, Sit-ups sowie Halte-Timer" auf — gegen den eigenen Produktnamen im Eyebrow darüber.
3. **Weiterentwicklung** — Jede neue Kategorie (Cardio, Mobility) vergrößert die Lücke. Je später der Schnitt, desto teurer: mehr Nutzer, mehr Rankings, mehr Play-Reviews an der alten Marke.

**Wichtige Abgrenzung:** Liegestütze bleiben eine erstklassige Übung mit eigenem Wiki-Bereich, eigenen Typen und eigenen Plänen. Das Rebranding entfernt Liegestütze nicht aus dem Produkt — es entfernt sie nur aus der **Dachmarke**.

---

## 2. Gemessenes Marken-Inventar

Alle Zahlen aus dem Repo-Stand `0e9e29f` (ohne `node_modules`, `dist`, `.git`).

### 2.1 Ändert sich

| Surface              | Ort                                                                                                                    | Menge                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Produktname im Code  | `web/src`, `libs`, `tools` (Prod, ohne Spec/Generated)                                                                 | 22 Dateien                                  |
| Produktname in Specs | `*.spec.ts` mit Marke oder Domain                                                                                      | 23 Dateien                                  |
| i18n-Quelle (DE)     | `web/src/locale/messages.xlf`                                                                                          | 52 Units mit „Pushup Tracker", 3 mit Domain |
| i18n-Targets         | `messages.{en,es,fr,it,nl,no,el,zh}.xlf`                                                                               | 99–110 Treffer je Locale                    |
| Domain               | repoweit `pushup-stats.com` / `.de`                                                                                    | 252 Dateien                                 |
| Content-Quelle       | `content/blog`, `content/wiki` (Frontmatter `heroImageCredit`, Tags, CTAs)                                             | 151 Dateien                                 |
| Generierter Content  | `web/src/app/blog/generated`, `*-content.generated.ts`                                                                 | 151 Dateien (abgeleitet — nur regenerieren) |
| `index.html`         | `<title>`, `og:site_name`, `og:image:alt`, Feed-Titel                                                                  | 1 Datei, ~6 Stellen                         |
| PWA-Manifest         | `web/public/manifest.webmanifest` (`name`, `short_name`, `description`)                                                | 1 Datei                                     |
| Logo & Icons         | `assets/pushup-logo.{png,webp}`, `icons/icon-*.png` (8), `badge-72x72.png`, `favicon.{ico,png}`, `pushup-stats-og.png` | 13 Assets                                   |
| Play-Listing         | `store/play/<locale>/{title,short-description,full-description}.txt`                                                   | 9 Locales × 3 Dateien = 27                  |
| Play-Grafiken        | `tools/src/store-graphics/compose-graphics.mjs` (Brand-Row)                                                            | 1 Generator                                 |
| TWA-Manifest         | `mobile/android-twa/twa-manifest.json` (`host`, `name`, `launcherName`, URLs)                                          | 1 Datei                                     |
| Feeds                | `tools/src/generate-feeds.js` (`BASE_URL`, 9 Blog-Titel)                                                               | 1 Datei → 9 generierte Feeds                |
| Sitemap              | `tools/src/generate-sitemap.js` (`BASE_URL`) → `web/public/sitemap.xml`                                                | 837 URLs                                    |
| Rechtstexte          | Impressum, Datenschutz, Über uns — `contact@pushup-stats.com`                                                          | 3 Komponenten                               |
| Hosting-Config       | `apphosting.yaml` `NG_ALLOWED_HOSTS`, `data-store/firebase.json` Rewrites                                              | 2 Dateien                                   |
| Route-Slug           | `/wiki/liegestuetz-typen`                                                                                              | 1 Route + Sitemap-Einträge                  |

### 2.2 Bleibt unverändert

Bewusst außen vor — Änderung wäre teuer und für Nutzer unsichtbar:

- **Firebase-Projekt-IDs** `pushup-stats` / `pushup-stats-staging-867b7` — Google erlaubt kein Umbenennen. Neues Projekt hieße Datenmigration von Firestore, Auth-Nutzern und Storage. Nicht verhandelbar teuer, kein Nutzen.
- **Storage-Bucket** `gs://pushup-stats-profile-photos` — Buckets sind unveränderlich, Umzug bedeutet Kopieren aller Profilbilder plus URL-Rewrite.
- **App-Hosting-Backend** `pushup-stats-service` — interner Bezeichner, taucht nur in `t-…run.app`-Hostnamen auf.
- **Nx-Pfad-Aliase** `@pu-stats/*`, `@pu-auth/*`, `@pu-push/*`, `@pu-reminders/*` — rein intern. Ein Rename ist ein Tausende-Zeilen-Diff ohne Produktwert. Optional in Phase 7, wenn überhaupt.
- **GitHub-Repo-Name** `pushup-stats-service` — GitHub leitet nach Rename zwar um, aber WIF-Setup (`infra/setup-wif.sh`), Release-Skripte und Board-Links hängen daran. Optional, Phase 7.
- **Übungs-IDs** `pushup`, `abs.situps`, … — Datenmodell, steckt in Firestore-Dokumenten und in generierten `firestore.rules`-Allowlists. Unangetastet.
- **Liegestütz-Wiki** (`content/wiki/pushup-types`, 117 Dateien) — bleibt als Feature-Bereich inklusive Inhalt.

### 2.3 Harte Constraint: Play-Package-ID

`mobile/android-twa/twa-manifest.json` → `packageId: com.pushupstats.app`.

**Die ID ist bereits gebunden — auch im Closed Test.** Eine Play-Package-ID liegt fest, sobald _irgendein_ Bundle in _irgendeinen_ Track hochgeladen wurde; der Closed-Test-Status ändert daran nichts. Ein Update muss dieselbe Application ID tragen, eine andere ID bedeutet zwingend ein **neues Play-Listing**.

Dass hier bereits hochgeladen wurde, steht im Repo: `twa-manifest.json` führt neben dem Upload-Key einen **Play-App-Signing-Fingerprint** — den vergibt Google erst nach dem ersten Bundle-Upload. Zusätzlich schiebt `.github/workflows/play-release.yml` bei jedem `main`-Push, der den Wrapper berührt, automatisch in den `internal`-Track.

Damit bleiben zwei Optionen:

| Option                                              | Folge                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — ID behalten, Listing umbenennen** (empfohlen) | Titel, Beschreibung, Icon, Grafiken werden neu; Installationen, Bewertungen und Rankings bleiben. Die alte ID sieht nur, wer die APK inspiziert. Kein Nutzer muss etwas tun.                           |
| B — neue Play-App unter neuer ID                    | Saubere ID, aber ein eigenes Listing: Installs, Bewertungen und Rankings starten bei null, Bestandsnutzer bekommen **kein** Update und müssen manuell wechseln. Braucht einen eigenen Teilplan (s.u.). |

→ **Empfehlung: A.** Die ID ist ein technischer Bezeichner, den praktisch niemand sieht — der Preis für B (Bewertungen weg, Zwangs-Neuinstallation für alle Tester) steht in keinem Verhältnis.

→ **Falls doch B:** Dann braucht Phase 5 drei zusätzliche Stränge, die in Option A komplett entfallen — ein eigener Test-Durchlauf der neuen App (Signing, Asset-Links, Closed-Test-Track neu aufsetzen), ein Migrationspfad für Bestandsnutzer (In-App-Hinweis plus Store-Link, da kein Update greift) und eine Kommunikation an die geworbenen Tester aus `/admin/android-test`. Das ist ein eigenes Ticket, kein Nebensatz in Phase 5.

→ **Einzige Ausnahme, die B billiger macht:** Google gibt eine Package-ID nur dann wieder frei, wenn die App gelöscht wird **und** sie null Lifetime-Installs hat. Sobald je eine Installation stattfand, ist die ID dauerhaft verbrannt — auch für dasselbe Entwicklerkonto. In Gate 0 also prüfen: Lifetime-Installs der bestehenden App.

---

## 3. Gate 0 — Namensentscheidung (kein Code)

Kein Ticket aus **Phase 2 und später** startet, bevor dieses Gate geschlossen ist. Ein halb durchgezogener Rename ist schlimmer als gar keiner.

**Phase 1 ist bewusst ausgenommen:** Sie zieht nur einen Brand-Layer ein und benennt nichts um. Sie funktioniert mit dem heutigen Namen genauso und sollte parallel zur Namensfindung laufen.

### 3.1 Kriterien

Ein Kandidat muss **alle** erfüllen:

1. **Übungsneutral** — trägt Liegestütze bis Cardio und Mobility, ohne eine Übung zu bevorzugen.
2. **DE und EN tragfähig** — Quelle ist Deutsch, ausgeliefert wird in 9 Sprachen. Kein Wortspiel, das nur in einer Sprache funktioniert.
3. **Play-Titel-Budget** — max. 30 Zeichen inkl. Untertitel. Zum Vergleich der heutige Titel: „Pushup Tracker: Liegestütze" = 27 Zeichen, also praktisch am Limit. Ein Name über ~14 Zeichen lässt keinen Untertitel mehr zu.
4. **Domain frei** — `.com` bevorzugt, `.de` als Ergänzung (der Bestand hat beide).
5. **Markenrechtlich unkritisch** — DPMA- und EUIPO-Recherche in Nizza-Klasse 9 (herunterladbare Software — die Android-App), 41 (Sport und Training) **und 42 (SaaS, Server-Hosting)**. Klasse 42 ist hier keine Formalie: Das Produkt ist in erster Linie eine gehostete Web-App, die Android-App nur ein TWA-Wrapper darum. Eine Recherche ohne 42 prüft den Hauptvertriebsweg nicht. Klassenumfang an den tatsächlich angebotenen Leistungen und Zielmärkten ausrichten (neun Sprachen, EU-weit) und vor der Registrierung von einer Markenfachperson bestätigen lassen. Bekannte Fitness-Marken meiden.
6. **Play-/App-Store-Kollisionsfrei** — keine bestehende Fitness-App gleichen Namens.
7. **Aussprechbar und tippbar** — kein Sonderzeichen, keine Umlaute in der Domain.

### 3.2 Richtungen (Ausgangspunkt für die Shortlist)

Die Richtung wurde offen gelassen; drei Stoßrichtungen mit unterschiedlichem Charakter:

- **Reps/Sets-Metapher** — beschreibt die Einheit, die die App zählt, unabhängig von der Übung. Trägt auch Halte-Timer schlecht, da diese in Sekunden zählen — prüfen.
- **Progress/Streak-Metapher** — stellt das Dranbleiben nach vorn (Heatmap, Streaks, Tagesziele sind Kernfeatures). Übungsneutral, emotional, gut international.
- **Calisthenics/Bodyweight-Metapher** — beschreibt die Trainingsform präzise. Riskant: schließt Cardio und Mobility semantisch aus und ist im deutschen Massenmarkt sperrig.

**Empfehlung:** Progress/Streak-Richtung. Sie ist die einzige, die nicht an die Zählweise gebunden ist und deshalb auch Halte-Timer, Cardio-Minuten und künftige Metriken trägt.

### 3.3 Ablauf

1. Pro Richtung 5–8 Kandidaten sammeln.
2. Gegen Kriterien 1–3 filtern (Schreibtischarbeit, keine externen Abfragen).
3. Für die verbleibenden 3–5: Domain-, Marken- und Store-Recherche.
4. Entscheidung dokumentieren — dieser Plan wird mit dem gewählten Namen aktualisiert, danach werden die Phasen-Issues angelegt.
5. Domain **vor** Phase 2 registrieren — das ist der Punkt, ab dem der Name nach außen geht. Ein Rename ohne gesicherte Domain ist ein Rückrufrisiko.

**Ergebnis von Gate 0:** gewählter Name, registrierte Domain, Play-Strategie (A oder B), neue Kontaktadresse (`contact@<neue-domain>`).

---

## 4. Phasen

Reihenfolge ist bewusst: erst das Refactoring, das den eigentlichen Rename klein macht; dann Nutzersichtbares; Domain und Store zuletzt, weil sie am wenigsten reversibel sind.

### Phase 1 — Brand-Layer zentralisieren (vor dem Rename)

**Status: überwiegend erledigt.** Die Konstanten, die Umstellung der Nicht-i18n-Literale und der Guard sind drin. Offen ist der i18n-Schritt (siehe unten).

**Problem:** Es gibt heute **keine zentrale Marken-Konstante.** „Pushup Tracker" steht 22-mal wörtlich in Prod-Quellen, `https://pushup-stats.com` als Literal in mindestens 8 Dateien (`dashboard-share.ts`, `achievement-celebration.service.ts`, `blog-article.component.ts`, `exercise-detail.component.ts`, `pushup-type-detail.component.ts`, `goal-reached-dialog`, `generate-feeds.js`, `generate-sitemap.js`). Ein Rename ohne diesen Schritt ist ein 250-Dateien-Suchen-und-Ersetzen mit hoher Fehlerquote.

**Erledigt:**

- `libs/stats/src/lib/models/brand.ts`, exportiert über `@pu-stats/models`: `BRAND_NAME`, `BRAND_DOMAIN` und die daraus zusammengesetzten `BRAND_URL`, `BRAND_CONTACT_EMAIL`, `BRAND_LOGO_URL`.
- Alle Nicht-i18n-Literale in Prod-Quellen umgestellt. Die lokalen `BASE_URL`-/`SHARE_URL`-Aliase sind aufgelöst statt umgebogen.
- Kontaktadresse in Impressum, Datenschutz und Über uns gebunden — sie stand als Text neben den i18n-Spans.
- **Guard-Test** `tools/src/brand-literal-guard.spec.js`: scannt `web/src` und `libs`, dazu Drift-Tests für den sw-push-Spiegel und die `BASE_URL` beider Generatoren.

**Zwei bewusste Ausnahmen**, beide durch den Guard nachgehalten:

- `libs/sw-push` spiegelt `BRAND_NAME` lokal. Der SW-Bundle bleibt frei von Cross-Package-Imports — dieselbe Entscheidung wie bei `SW_SUPPORTED_LOCALES`. Ein Barrel-Import würde den Übungskatalog in einen Service Worker ziehen, der wenige KB groß bleiben soll.
- `web/src/index.html` wird ausgeliefert, bevor Angular bootet, und kann nichts importieren.

**Offen — der i18n-Schritt:** 19 Dateien tragen die Marke noch innerhalb von `$localize`-Messages und `i18n`-Template-Text. Diese auf Platzhalter umzustellen ändert den Message-Source und seedet alle acht Ziel-Locales neu, ist also ein eigener Durchgang mit `extract-i18n` + `sync-xliff-locales` und einem Lauf der Übersetzungs-Routine. Die Allowlist `TRANSLATABLE_COPY` im Guard ist die Inventarliste; ein Eintrag, der nicht mehr gebraucht wird, lässt die Suite fehlschlagen, die Liste kann also nur schrumpfen.

Der Aufwand dafür ist nicht zusätzlich, sondern vorgezogen: Ohne Platzhalter müssen dieselben Messages in Phase 2 angefasst werden. Mit Platzhaltern überleben die Übersetzungen auch jeden künftigen Rename.

**Tests:** Guard-Test neu. Die markenbehafteten Specs bleiben unverändert — sie prüfen die URL als Wert, nicht als Literal, und liefen ohne Anpassung durch.

**Ausliefert:** nichts Sichtbares. Reines Refactoring, geht normal über `main`.

**Risiko:** niedrig. Größter Nutzen des ganzen Plans pro Aufwand.

---

### Phase 2 — Produktname in UI und i18n

**Arbeit:**

- `BRAND_NAME` in `libs/stats/src/lib/models/brand.ts` auf den neuen Namen setzen → schlägt über `@pu-stats/models` auf alle Prod-Quellen durch, die Phase 1 umgestellt hat. `BRAND_DOMAIN` bleibt hier unberührt; die daraus abgeleiteten URL- und Kontaktwerte wechseln erst mit der Domain in Phase 4.
- `SW_BRAND_NAME` in `libs/sw-push/src/handlers.ts` mitziehen. Der Service Worker importiert bewusst nicht — ohne diesen Schritt schlägt der Drift-Test in `tools/src/brand-literal-guard.spec.js` fehl. Das ist genau seine Aufgabe.
- Deutsche i18n-Quelle anpassen: die verbliebenen Units mit Markenbezug in `messages.xlf` — **nur Deutsch**, laut `CLAUDE.md` schreiben Entwickler keine Fremdsprach-Targets. Sind sie zuvor auf Platzhalter umgestellt (offener i18n-Schritt aus Phase 1), entfällt dieser Punkt ersatzlos.
- `pnpm nx run web:extract-i18n && node tools/src/sync-xliff-locales.mjs` — die Seed-Fallbacks halten den Prod-Build grün, die tägliche Übersetzungs-Routine liefert die echten Targets nach.
- `web/src/index.html`: `<title>`, `og:site_name`, `og:image:alt`, Feed-Link-Titel. Die Datei steht auf der `NO_MODULE_SYSTEM`-Ausnahmeliste des Guards, weil sie nichts importieren kann — hier wird wirklich von Hand editiert.
- `web/public/manifest.webmanifest`: `name`, `short_name`, `description`.
- Landing-Page: Eyebrow, Logo-`alt`, Subtitle so umschreiben, dass die Übungsbreite die Botschaft trägt statt sie zu korrigieren.
- `tools/src/generate-feeds.js`: 9 Blog-Titel.

**Nicht hier:** Die Kontaktadresse in Impressum, Datenschutz und Über uns ist seit Phase 1 an `BRAND_CONTACT_EMAIL` gebunden und folgt automatisch, sobald `BRAND_DOMAIN` in Phase 4 wechselt. Zu tun bleibt dort nur das, was kein Code erledigt: das Postfach einrichten und die alte Adresse weiterleiten.

**Tests:** bestehende Specs laufen dank Phase 1 unverändert durch; Snapshot-/Text-Assertions, die die Marke prüfen, ziehen die Konstante.

**Wichtig:** Diese Phase läuft **vor** dem Domain-Wechsel. Der neue Name unter der alten Domain ist ein sauberer Zwischenzustand — die Nutzer sehen die Marke, die Rankings bleiben unberührt.

---

### Phase 3 — Logo, Icons, Grafiken

**Arbeit:**

- Neues Logo (Quadrat-Quelle, PNG). Vom Liegestütz-Piktogramm weg zu einem übungsneutralen Zeichen.
- `pnpm dlx -p sharp -p png-to-ico node tools/src/generate-logo-assets.js <neu.png>` — das Skript ist explizit für Rebrands gebaut und erzeugt alle 8 PWA-Icons, `badge-72x72.png`, beide Favicons und das In-App-Logo in PNG + WebP.
- Asset-Dateinamen (`pushup-logo.*`) mitziehen — Referenzen in `landing-page.component.html`, `stats-dashboard.component.html`, `generate-logo-assets.js`.
- OG-Bild `pushup-stats-og.png` neu erzeugen **und** den Rewrite in `data-store/firebase.json` (Zeile 64–65) mitziehen.
- `tools/src/store-graphics/compose-graphics.mjs`: Brand-Row auf neuen Namen und neues Icon.

**Tests:** `tools/src/blog-image-assets.spec.js` und `store-graphics.spec.js` prüfen die Asset-Pipeline — beide müssen grün bleiben.

**Reihenfolge-Hinweis:** Phase 3 sollte mit Phase 2 **im selben Release** landen. Neuer Name mit altem Liegestütz-Logo sieht nach Fehler aus.

---

### Phase 4 — Domain-Migration (die riskanteste Phase)

837 URLs in der Sitemap, 9 Sprachen, hreflang-Netz über alle. Hier wird organischer Traffic verspielt, wenn etwas schief geht.

**Reihenfolge — nicht abkürzen:**

1. Neue Domain in Firebase Hosting **und** App Hosting als Custom Domain eintragen, Zertifikat abwarten.
2. `apphosting.yaml` → `NG_ALLOWED_HOSTS` um die neue Domain **erweitern** (alte drin lassen). Ohne diesen Schritt weist der Angular-SSR-SSRF-Guard die neue Domain ab.
3. `BRAND_DOMAIN` auf die neue Domain setzen — `BRAND_URL`, `BRAND_CONTACT_EMAIL` und `BRAND_LOGO_URL` leiten sich daraus ab und folgen. Die `BASE_URL` in `tools/src/generate-feeds.js` und `generate-sitemap.js` von Hand mitziehen: als Node-Skripte können sie die TS-Konstante nicht importieren, der Drift-Test hält sie nur nach. Danach Sitemap und Feeds neu generieren.
4. Beide Domains parallel live, neue ist kanonisch: `rel=canonical`, `og:url` und alle hreflang-Einträge zeigen auf neu.
5. **301** (nicht 302) von `pushup-stats.com/*` und `.de/*` auf pfadgleiche Ziele der neuen Domain. Pfade bleiben identisch — inklusive `/de`, `/en`, … Präfixe.
6. Google Search Console: neue Property, Sitemap einreichen, **Adressänderung** für beide alten Domains melden.
7. Alte Domains mindestens 12 Monate halten und weiterleiten. Google braucht Monate, Backlinks Jahre.
8. `web/public/robots.txt` und das Site-Verification-File (`14fada…txt`) auf die neue Property prüfen.

**Ebenfalls hier:** Route-Slug `/wiki/liegestuetz-typen` — falls er neutraler werden soll, gehört diese Änderung mit 301 in dieselbe Migration, nicht in eine zweite Welle. Zwei SEO-Umzüge hintereinander kosten doppelt. **Empfehlung: Slug behalten.** Er beschreibt korrekt einen Liegestütz-Bereich und rankt vermutlich auf Liegestütz-Queries — genau die will man nicht wegwerfen.

**Tests:** `tools/src/robots-coverage.spec.js`, `generate-sitemap.spec.js` und `web/src/server-locale-redirect.spec.ts` decken Teile ab. Für die 301-Regeln kommt ein neuer Spec dazu. `server-locale-redirect.spec.ts` prüft schon heute, dass `/.well-known/assetlinks.json` **nicht** umgeleitet wird — diese Zusicherung muss auf der neuen Domain genauso halten, sonst bricht die TWA-Verifikation.

**Rollback:** Solange beide Domains live sind und der Canonical zurückgedreht werden kann, ist Schritt 3–5 reversibel. Ab der Adressänderung in der Search Console (Schritt 6) praktisch nicht mehr — deshalb dort ein bewusster Halt.

---

### Phase 5 — Play Store und TWA

Setzt Phase 4 voraus: Die TWA ist an den Host gebunden.

**Arbeit:**

- `mobile/android-twa/twa-manifest.json`: `host`, `name`, `launcherName`, `iconUrl`, `maskableIconUrl`, `webManifestUrl`, `fullScopeUrl`. Der `keystore.path` zeigt auf einen lokalen Pfad (`/home/wolf/…`) — beim Regenerieren nicht verlieren.
- **Signing-Key unverändert lassen.** Ein neuer Key macht das Update für alle Bestandsnutzer unmöglich.
- `assetlinks.json` für die neue Domain erzeugen und unter `/.well-known/` der **neuen** Domain ausliefern. Fingerprint bleibt gleich. Solange die alte Domain 301 leitet, prüfen, ob die App-Verifikation weiterhin greift.
- Play-Listing für alle 9 Locales: `title.txt` (30-Zeichen-Grenze!), `short-description.txt`, `full-description.txt`. Deutsch ist Quelle, die acht Übersetzungen entstehen in derselben Änderung.
- **Längenbudget ist der Engpass.** Play zählt UTF-16-Code-Units (JVM-Backend), nicht Bytes und nicht Glyphen — `countCharacters` in `tools/src/play-listing-source.mjs` bildet das nach. Emoji zählen dabei 2–3 Units pro Glyphe (`📷` = 2, `🏋️` = 3). Gegen das Limit von 4000 bleibt bei `full-description.txt` fast nichts übrig:

  | Locale | Units | Luft |
  | ------ | ----- | ---- |
  | it-IT  | 3996  | 4    |
  | es-ES  | 3995  | 5    |
  | fr-FR  | 3990  | 10   |
  | de-DE  | 3978  | 22   |
  | el-GR  | 3978  | 22   |
  | en-US  | 3964  | 36   |
  | nl-NL  | 3927  | 73   |
  | no-NO  | 3883  | 117  |
  | zh-CN  | 1639  | 2361 |

  Ein neuer Absatz über die Übungsbreite passt in **keine** der acht westlichen Locales, ohne dass anderswo gekürzt wird — in `it-IT` reicht es nicht einmal für ein längeres Wort. Der Rename selbst ist netto meist neutral, aber jedes Zeichen, das der neue Name über „Pushup Tracker" hinausgeht, schlägt an jeder Nennung zu. `pnpm nx test tools` bricht bei Überschreitung, also fällt das in CI auf — aber erst nachdem die Übersetzungen schon geschrieben sind. Deshalb: Kürzungen **mit** dem neuen Text planen, nicht danach.

- Play-Grafiken neu erzeugen (`tools/src/store-graphics/`).
- Package-ID bleibt (Option A). Nur falls Gate 0 doch auf B fällt, kommen die drei Zusatzstränge aus Abschnitt 2.3 als eigenes Ticket dazu.

**Tests:** `pnpm nx test tools` deckt Listing-Längen und Play-Publish-Skripte ab (`play-listing-source.spec.js`, `publish-play-release.spec.js`).

---

### Phase 6 — Content und Nutzer-Kommunikation

**Arbeit:**

- 151 Content-Quelldateien unter `content/`: `heroImageCredit`-Frontmatter (10× je Sprache), Tag `Pushup Tracker app`, CTAs mit alter Domain. Deutsch ist Quelle — für die Fremdsprachen greift die Übersetzungs-Routine, außer bei reinen Namens-/URL-Ersetzungen, die sprachübergreifend identisch sind.
- `pnpm nx run tools:generate-content` (bzw. `node tools/src/generate-content.mjs`) — regeneriert die 151 abgeleiteten TS-Module unter `web/src/app/blog/generated` und die `*-content.generated.ts`. **Nie von Hand editieren.**
- Feeds regenerieren.
- **Feature-Announcement:** Neuer Eintrag in `ANNOUNCEMENTS` (`web/src/app/core/feature-announcement.service.ts`) mit frischer ID und einem kurzen Dialog: „Wir heißen jetzt X — hier ist warum, und das kann die App inzwischen alles." Erscheint einmal pro Account auf `/app`. Das ist laut `CLAUDE.md` Pflicht für nutzersichtbare Änderungen und hier besonders sinnvoll: Bestandsnutzer sollen die neue Marke nicht als fremde App erleben.
- **Landing-Page-Sektion** über die Übungsbreite, „Neu"-getaggt — dieselbe Regel.
- Blog-Artikel zum Rebranding: erklärt den Namenswechsel, fängt Suchanfragen nach dem alten Namen ab und gibt der Search-Console-Adressänderung einen inhaltlichen Anker.

---

### Phase 7 — Interne Bezeichner (optional, zuletzt)

Bewusst am Ende und explizit **optional**. Kein Nutzer sieht das; der Diff ist groß.

- Nx-Aliase `@pu-stats/*` → neues Kürzel.
- GitHub-Repo-Rename (zieht `infra/setup-wif.sh`, `infra/setup-staging.sh`, `teardown-staging.sh`, `scripts/fetch-release-artifact.sh` und die Board-Links nach sich).
- `docs/PUS_ROADMAP.md`, `docs/PUS_EXECUTION_CHECKLIST.md`, `README.md`, `CLAUDE.md`.

**Empfehlung:** Nur Docs und README (billig, verwirrt sonst jeden neuen Mitlesenden). Aliase und Repo-Rename nur, wenn ohnehin ein großer Umbau ansteht.

---

## 5. Abhängigkeiten

```
Gate 0 (Name + Domain + Play-Option)
   │
   ├─→ Phase 1 (Brand-Layer)          ← kann vor Gate 0 starten
   │        │
   │        └─→ Phase 2 (UI/i18n) ──┬─→ gemeinsames Release
   │            Phase 3 (Assets) ───┘
   │                 │
   │                 └─→ Phase 4 (Domain) ──→ Phase 5 (Play/TWA)
   │                          │
   │                          └─→ Phase 6 (Content + Announcement)
   │
   └─→ Phase 7 (intern, optional, jederzeit danach)
```

**Phase 1 ist der einzige Teil, der ohne Namensentscheidung losgehen kann** — und der, der alles Weitere billig macht. Empfehlung: sofort starten, parallel zur Namensfindung.

---

## 6. Risiken

| Risiko                                          | Wirkung                                        | Gegenmaßnahme                                                                                       |
| ----------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| SEO-Einbruch nach Domain-Wechsel                | Organischer Traffic auf 837 URLs               | 301 statt 302, pfadgleich, Search-Console-Adressänderung, alte Domains ≥12 Monate halten            |
| Play-Package-ID ist bereits gebunden            | Marke und ID dauerhaft auseinander             | Option A: Listing umbenennen, ID behalten — die ID ist nach außen unsichtbar                        |
| TWA-Verifikation bricht nach Domain-Wechsel     | App öffnet mit Browser-Chrome statt fullscreen | `assetlinks.json` auf neuer Domain **vor** dem APK-Update ausliefern; Redirect-Ausnahme testen      |
| Halber Rename (Name neu, Logo/Store alt)        | Wirkt wie Bug, beschädigt Vertrauen            | Phase 2+3 zusammen releasen; Phase 4+5 dicht hintereinander                                         |
| 8 Locales laufen der deutschen Quelle hinterher | Fremdsprach-UI mischt alte und neue Marke      | `sync-xliff-locales.mjs`-Fallbacks halten den Build grün; Routine-Lauf **vor** dem Release abwarten |
| Bestandsnutzer erkennen die App nicht wieder    | Deinstallationen, schlechte Reviews            | Announcement-Dialog (Phase 6) + Blog-Artikel; Icon-Formsprache erkennbar überführen                 |
| Markenrechtlicher Konflikt beim neuen Namen     | Erzwungener zweiter Rename — Totalschaden      | Gate-0-Kriterium 5 ist blockierend, nicht optional                                                  |
| Neue Domain nicht in `NG_ALLOWED_HOSTS`         | SSR liefert 403, Seite komplett tot            | Schritt 2 der Phase-4-Reihenfolge, vor dem Canonical-Umzug                                          |

---

## 7. Aufwandseinschätzung

| Phase           | Aufwand      | Anmerkung                                                       |
| --------------- | ------------ | --------------------------------------------------------------- |
| Gate 0          | 1–2 Tage     | Recherche-lastig, kein Code                                     |
| 1 — Brand-Layer | 1 Tag        | Refactoring + Guard-Test, gut testbar                           |
| 2 — UI/i18n     | 0,5 Tage     | Nach Phase 1 fast trivial; Übersetzungs-Routine braucht 1 Lauf  |
| 3 — Assets      | 1–2 Tage     | Abhängig vom Logo-Design, nicht von der Technik                 |
| 4 — Domain      | 1 Tag Arbeit | Plus Wochen bis Monate Beobachtung der Rankings                 |
| 5 — Play/TWA    | 1 Tag        | Plus Play-Review-Zeit                                           |
| 6 — Content     | 1 Tag        | Großteils Skript-getrieben, Announcement + Blog sind Handarbeit |
| 7 — Intern      | offen        | Optional                                                        |

---

## 8. Offene Punkte für Gate 0

1. **Name** — Shortlist nach Abschnitt 3, dann Entscheidung.
2. **Domain** — Verfügbarkeit prüfen, `.com` + `.de` registrieren, **bevor** Phase 2 startet.
3. **Play-Lifetime-Installs** — nur bei null Installs gäbe Google die ID nach einer Löschung wieder frei. Das ist die einzige Zahl, die Option B noch günstiger machen könnte; ansonsten bleibt es bei Option A.
4. **Kontaktadresse** — `contact@<neue-domain>` einrichten; alte Adresse für die Übergangszeit weiterleiten (steht in Impressum und Datenschutz, also rechtlich relevant).
5. **Logo-Richtung** — soll die Formsprache des alten Icons erkennbar bleiben (sanfterer Übergang) oder bewusst brechen?
6. **Route-Slug `/wiki/liegestuetz-typen`** — Empfehlung ist behalten; falls doch neutral, muss es in Phase 4 mit.
