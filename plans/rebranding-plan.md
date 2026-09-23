# Rebranding-Plan

**Status:** Planung — wartet auf Namensentscheidung (Gate 0)
**Entschiedener Umfang:** Voll — neuer Name, neue Domain, neues Play-Listing
**Erstellt:** 2026-09-20

---

## 1. Warum

Die Marke sagt „Liegestütze“. Das Produkt ist längst etwas anderes.

Was heute drinsteckt:

| Bereich           | Umfang                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Übungskatalog     | 9 Kategorien: `pushup`, `push`, `pull`, `squat`, `hinge`, `lunge`, `core`, `cardio`, `mobility`                                                                   |
| Übungs-Wiki       | 40 Übungen × 9 Locales = 360 Content-Dateien (`content/wiki/exercises`)                                                                                           |
| Liegestütz-Wiki   | 13 Varianten × 9 Locales = 117 Dateien — echter Teil-Bereich, kein Markenkern                                                                                     |
| Trainingspläne    | 10 Pläne, fünf mit anderem Ziel als dem Liegestütz (Push/Pull, Ganzkörper, Rumpf, HIIT, Mobility) — Liegestütze kommen dort als Baustein vor, 27–43 % der Übungen |
| Eigene Sessions   | `/workouts` — frei zusammenstellbare Workouts                                                                                                                     |
| Kamera-Autozähler | Reps **und** Halte-Timer (Plank, Hollow-Hold), nicht nur Liegestütze                                                                                              |
| Social            | Freunde, Bestenliste, öffentliche Profile, Nachrichten-Inbox, Abzeichen                                                                                           |
| Content           | 21 Blog-Artikel in 9 Sprachen (Kniebeugen, Klimmzüge, HIIT/Zone 2, Schlaf, Rumpftraining …)                                                                       |
| Weiteres          | KI-Coach, Push-Erinnerungen, Analyse-Views, Heatmap/Streaks                                                                                                       |

Der Mismatch wirkt auf drei Ebenen:

1. **Akquise** — Play-Titel „Pushup Tracker: Liegestütze“ und Domain `pushup-stats.com` filtern Nutzer weg, die Kniebeugen, Klimmzüge oder Ganzkörpertraining suchen. Die 21 Blog-Artikel ranken teils auf Nicht-Liegestütz-Themen und landen auf einer Marke, die dem Thema widerspricht.
2. **Erwartung** — Wer wegen Liegestützen kommt, findet ein breiteres Produkt vor als beworben. Die Landing-Subtitle zählt bereits „Liegestütze, Kniebeugen, Klimmzüge, Sit-ups sowie Halte-Timer“ auf — gegen den eigenen Produktnamen im Eyebrow darüber.
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
| i18n-Quelle (DE)     | `web/src/locale/messages.xlf`                                                                                          | 52 Units mit „Pushup Tracker“, 3 mit Domain |
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

1. **Übungsneutral, mindestens** — trägt Liegestütze bis Cardio und Mobility, ohne eine Übung zu bevorzugen. **Verschärfung vom 2026-09-22, siehe 3.7:** Wenn das Produkt sich zu „zähl irgendetwas und behalte die Statistik“ öffnet, muss der Name **domänenneutral** sein — er muss Liegestütze _und_ Kaffeetassen _und_ gelesene Seiten tragen. Ob diese Öffnung Absicht oder bloße Möglichkeit ist, ist **nicht entschieden** (offener Punkt 6). Solange das offen ist, gilt die schärfere Lesart als Filter, weil ein Name, der beides trägt, in beiden Welten funktioniert — umgekehrt nicht.
2. **DE und EN tragfähig** — Quelle ist Deutsch, ausgeliefert wird in 9 Sprachen. Kein Wortspiel, das nur in einer Sprache funktioniert.
3. **Play-Titel-Budget** — max. 30 Zeichen inkl. Untertitel. Zum Vergleich der heutige Titel: „Pushup Tracker: Liegestütze“ = 27 Zeichen, also praktisch am Limit. Ein Name über ~14 Zeichen lässt keinen Untertitel mehr zu.
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

**Positionierung entschieden (2026-09-21): international, EN-first.** Der Name muss auf Englisch tragen und in allen neun Sprachen funktionieren; Deutsch bleibt Quellsprache, ist aber einer von neun Märkten. Damit scheiden deutsche Wortspiele aus, und auch der Play-Untertitel wird englisch.

### 3.3 Erste Recherche — was bereits ausscheidet

Stand 2026-09-21, per Websuche geprüft. **Domain- und Markenrecherche fehlt weiterhin** (Abschnitt 8): die Umgebung, in der diese Prüfung lief, kommt nicht an RDAP heran, und Kriterium 5 verlangt ohnehin eine Markenfachperson.

| Kandidat               | Status  | Grund                                                                                                 |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Cadence                | ❌ raus | Zweifach als Fitness-App belegt: Krafttracker bei Google Play _und_ GPS-Run/Bike-App (getcadence.app) |
| Steady                 | ❌ raus | Als App-Name mehrfach vergeben (Gig-Economy-Plattform, Membership-Dienst)                             |
| **alles mit „Streak“** | ❌ raus | Namensraum gesättigt: FitStreak, Streak – Gym Log, GymStreak, StreakUp, MyStreaks, RunStreaker        |
| **alles mit „Fit“**    | ❌ raus | Dieselbe Sättigung, zusätzlich schwache Unterscheidungskraft                                          |

**Die wichtigste Erkenntnis:** Die Progress/Streak-_Richtung_ bleibt richtig — das Dranbleiben ist der Kern des Produkts. Ihre naheliegendste sprachliche Umsetzung ist es nicht. Ein Name mit „Streak“ oder „Fit“ scheitert doppelt: an Kriterium 6 (Store-Kollision) und an Kriterium 5, weil Markenschutz Unterscheidungskraft voraussetzt und beide Wörter in Klasse 9/41 längst verwässert sind.

Daraus folgt eine Verschärfung von Kriterium 4 und 5, die beim Aufstellen der Kriterien noch nicht sichtbar war: **Ein gängiges englisches Wörterbuchwort erfüllt in der Praxis weder „Domain frei“ noch „markenrechtlich unkritisch“.** Die freie `.com` ist bei einem Wort wie `upkeep` oder `onward` seit Jahrzehnten vergeben, und ein generisches Wort ist in der eigenen Warenklasse kaum durchsetzbar. Die realistische Zone sind **Komposita und leicht kunstsprachliche Formen** — so wie es die Vergleichsprodukte gelöst haben (Strava, Zwift, Whoop, Hevy: alle erfunden; Setgraph: Kompositum).

### 3.4 Shortlist — Stand 2026-09-21

Gebildet nach der Erkenntnis aus 3.3: keine Wörterbuchwörter, sondern Komposita und Kunstwörter. Alle Kandidaten per Websuche auf Store- und Markenkollision geprüft.

**Ausgeschieden in dieser Runde** — jeweils mit Beleg:

| Kandidat  | Grund                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| RepStack  | Existiert als Krafttraining-App im App Store                                                                                      |
| Holdfast  | Als App vergeben; Holdfast Properties hält eine Marke für Software „for tracking and monitoring exercise“ — genau die Warenklasse |
| Tallio    | Inventar-App im App Store                                                                                                         |
| Onvia     | Mehrfach besetzt: Onvia Inc. (Deltek), ONVIA by Marriott, Onvia Home                                                              |
| Everlog   | Existiert als Krafttraining-Tracker bei Google Play, dazu eine Journal-App                                                        |
| KeepCount | Tally-Counter-App, ausdrücklich auch für Workouts                                                                                 |
| Habitus   | Gym-App bei Google Play                                                                                                           |
| Tonus     | Mehrere Gym-Apps (Tonus Gym, Tonus fitnes klub, Fyt Tonus)                                                                        |

**Überlebende der ersten Runde** — keine Store-Treffer:

| Kandidat | Zeichen | Bedeutung                  | Schwäche                                                            |
| -------- | ------: | -------------------------- | ------------------------------------------------------------------- |
| Everkeep |       8 | Was du behältst, dauerhaft | „Keep“-Stamm, siehe unten                                           |
| Daykeep  |       7 | Der tägliche Verlauf       | „Keep“-Stamm                                                        |
| Keepline |       8 | Die Linie halten           | „Keep“-Stamm                                                        |
| Kepta    |       5 | Kunstwort aus „kept“       | Bedeutung undurchsichtig; phonetisch nah an „Keep“                  |
| Repora   |       6 | Kunstwort aus „rep“        | „rep“ bindet an Wiederholungen — trägt Halte-Timer sprachlich nicht |

**Der Haken, den diese Liste hat:** Drei der fünf teilen den Stamm „Keep“, und Google Keep ist eine eingetragene Marke in derselben Nizza-Klasse 9 (herunterladbare Software). Der Stamm ist semantisch genau richtig für ein Produkt, dessen Kern der gehaltene Verlauf ist — aber ob die Nähe tragfähig ist, entscheidet Kriterium 5, nicht diese Recherche. Fällt die Markenprüfung dort negativ aus, bleiben nur Kepta und Repora, und es braucht eine weitere Runde.

**Kriterium 3 ist für alle fünf erfüllt.** Nachgerechnet gegen das 30-Zeichen-Budget (heutiger Titel „Pushup Tracker: Liegestütze“ = 27):

| Untertitel           | Everkeep | Daykeep | Keepline | Kepta | Repora |
| -------------------- | -------: | ------: | -------: | ----: | -----: |
| `Bodyweight Tracker` |       28 |      27 |       28 |    25 |     26 |
| `Bodyweight Log`     |       24 |      23 |       24 |    21 |     22 |
| `Train & Track`      |       23 |      22 |       23 |    20 |     21 |

Jede Kombination passt. Das war beim heutigen Namen nicht selbstverständlich — er liegt mit 27 Zeichen praktisch am Limit.

**Nachtrag 2026-09-21 — die Shortlist ist an der Domain gescheitert, nicht an der Marke.**

Die Verfügbarkeitsprüfung war doch möglich: RDAP bleibt durch den Egress-Proxy gesperrt, aber DNS-Auflösung funktioniert. Das ist ein **Ausschluss-, kein Freigabetest** — löst eine Domain auf, ist sie sicher vergeben; löst sie nicht auf, kann sie trotzdem registriert sein (kein A-Record). `.com` kennt keinen Wildcard, eine Auflösung ist also beweiskräftig.

Ergebnis für die fünf Kandidaten, jeweils `.com` / `.de` / `.app`:

| Kandidat | .com     | .de             | .app            |
| -------- | -------- | --------------- | --------------- |
| Everkeep | vergeben | vergeben        | vergeben        |
| Daykeep  | vergeben | vergeben        | vergeben        |
| Keepline | vergeben | keine Auflösung | keine Auflösung |
| Kepta    | vergeben | vergeben        | vergeben        |
| Repora   | vergeben | vergeben        | vergeben        |

**13 von 15 vergeben. Die `.com` ist bei allen fünf weg** — und damit Kriterium 4 verfehlt. Mehrere lösen auf Adressen auf, die nach Parking aussehen; ob solche Domains käuflich sind, zeigt erst der Registrar.

### 3.5 Was die Domainprüfung über das Verfahren lehrt

Eine zweite Runde über 46 konstruierte Namen, direkt DNS-gefiltert: **35 vergeben, 11 ohne Auflösung.** Von diesen elf fielen bei ergänzenden Checks weitere — die Evidenz ist je Kandidat unterschiedlich:

- **Vantra** — bereits ein „AI Fitness Companion“, direkte Kollision
- **Talvio** — laufendes Geschäft auf `talvio.co`
- **Vantio** — laufendes Geschäft auf `vantio.app`
- **Ritmo** — Registrierungsstatus ungeklärt; ausgeschlossen aus einem anderen Grund: ein gängiges spanisches und italienisches Wörterbuchwort scheitert an Kriterium 5, weil Markenschutz Unterscheidungskraft voraussetzt
- **Kepto** — Beiklang „Klepto“

Übrig aus 46 nach den belegten Ausschlüssen: **sechs** — Tallyo, Haltra, Holdday, Holdever, Repvault, Stedva. Weitergetragen wurde nur **Tallyo**; die anderen fünf fielen nach Klang- und Lesbarkeitsurteil, ohne dass der Grund festgehalten wurde. Das ist eine Lücke im Verfahren, keine Nebensache: Die Trefferquote unten hängt davon ab, ob diese fünf zu Recht fielen — belegt ist das nicht.

Daraus zwei Regeln für die nächste Runde:

1. **Die `.com`-Prüfung und die Markenprüfung sind unabhängig.** Talvio und Vantio haben **keine** `.com`-Auflösung und trotzdem ein laufendes Geschäft auf einer anderen TLD. Beides muss geprüft werden, keins ersetzt das andere.
2. **Die Trefferquote liegt zwischen 2 % und 13 %.** Aus 46 konstruierten Namen blieb einer weitergetragener (2 %); sechs hatten keinen belegten Ausschlussgrund (13 %). Wer fünf brauchbare Kandidaten will, muss mit einigen hundert starten — oder die Anforderung „freie `.com`“ aufgeben.

**Damit steht eine Entscheidung an, die Gate 0 vorgelagert ist:**

- **A — `.com` bleibt Pflicht.** Dann braucht es eine maschinelle Runde über mehrere hundert Kunstwörter mit DNS-Vorfilter. Aufwand vertretbar, Ergebnis unsicher, weil die überlebenden Namen zwangsläufig immer beliebiger werden.
- **B — `.com` kaufen.** Mehrere der geprüften Domains stehen offenbar geparkt. Ein Kaufangebot kostet Geld und Verhandlungszeit, liefert aber einen Namen mit Bedeutung.
- **C — andere TLD akzeptieren.** `.app` ist für eine App naheliegend und HSTS-preloaded, also zwingend HTTPS. Das löst das Problem sofort, kostet aber die Selbstverständlichkeit der `.com` und macht Tippfehler-Traffic zum Risiko.

Ohne diese Entscheidung ist jede weitere Kandidatenrunde Rätselraten.

### 3.6 Entschieden: A und C — und was dabei herauskam

Entscheidung vom 2026-09-21: **das Verfahren aus A, die Anforderung aus C.** Maschinelle Runde über mehrere hundert Namen fahren, `.app` als gleichwertige TLD zulassen.

In 3.5 stehen A und C als Alternativen, und das bleiben sie: A macht die `.com` zur Pflicht, C gibt genau diese Pflicht auf. Übernommen wird deshalb nicht beides, sondern **die Suchmethode von A und das Domain-Kriterium von C.** Wo eine freie `.com` ohnehin abfällt, wird sie mitgenommen — verlangt wird sie nicht mehr.

**Runde 1 — Kunstwörter, 1051 generiert.** Aus Morphemen kombiniert, gefiltert auf Sprechbarkeit und Beiklänge. Ergebnis: 382 ohne `.com`-Auflösung (36 %), 367 davon auch ohne `.app`-Auflösung.

Der DNS-Durchlass liegt damit bei 36 % gegen 24 % in der Handrunde (11 von 46) — **Faktor 1,5, und die Überlebenden sind unbrauchbar.** Ende zu Ende ist die Maschinenrunde sogar schlechter als die Handarbeit: aus 1051 Namen ging **keiner** weiter, aus 46 einer. „agonka“, „fibraso“, „stedeus“, „morravo“: ohne `.com`-Auflösung genau deshalb, weil sie nichts bedeuten. Dazu Beiklänge, die ein Filter nicht fängt: `nerv-` (nerven), `agon-` (agony), `sedu-` (seduce), `volva-`.

Das ist der Befund zu Option A: **Sie liefert DNS-Durchlass, nicht Qualität** — und Durchlass ist nicht einmal Verfügbarkeit, sondern nur das Fehlen eines A-Records. Wer aus dieser Menge wählt, wählt einen Namen, den niemand behält.

**Runde 2 — bedeutungsvolle Komposita, 502 generiert.** Option C macht diesen Weg erst möglich: Ein gutes Kompositum hat eine vergebene `.com` gerade _weil_ es gut ist — aber `.app` ist weit weniger gesättigt. Ergebnis: **295 ohne `.app`-Auflösung, davon 54 auch ohne `.com`-Auflösung.**

Bei diesen 54 löst weder `.com` noch `.app` auf. Das ist **keine** Freigabe — nicht-auflösen heißt nur, dass kein A-Record gesetzt ist; es ist dieselbe Umkehrung, die dieser Abschnitt weiter unten ausdrücklich ausschließt. Ob eine davon frei ist, sagt der Registrar. Nach Lesbarkeit, Übungsneutralität und Beiklang gefiltert und auf Kollisionen geprüft:

| Kandidat      | Zeichen | Bedeutung                              | .com  | .app  | .de   |
| ------------- | ------: | -------------------------------------- | ----- | ----- | ----- |
| **Movepath**  |       8 | Der Pfad der Bewegung                  | frei? | frei? | frei? |
| **Tallyspan** |       9 | Was du über eine Spanne zusammenzählst | frei? | frei? | frei? |
| **Holdspan**  |       8 | Die Spanne, die du hältst              | frei? | frei? | frei? |

„frei?“ heißt: keine DNS-Auflösung. Das bleibt ein Ausschluss-, kein Freigabetest — der Registrar entscheidet.

**Was aus Tallyo wurde.** Der einzige Überlebende aus 3.5 steht nicht in dieser Tabelle, und das braucht einen Grund: `tallyo.com` löst nicht auf, `tallyo.app` und `tallyo.de` sind **vergeben**. Unter der Anforderung aus C — `.app` als gleichwertige TLD — fällt damit der Ausweichweg weg, und die `.de`-Ergänzung aus Kriterium 4 ebenfalls. **Auch Tallyo ist überholt:** Der Stamm _tally_ ist in 3.7 ausgeschlossen, Tallyo ist damit kein Rückfallkandidat mehr.

**Zurückgestellt in dieser Runde:** _Everspan_ — EverSpan Life, LLC hält eine eingetragene US-Marke, unter anderem für Ernährungsberatung, also angrenzend; dazu Everspan Group und Everspan Solutions.

**Zurückgestellt, nicht ausgeschieden**, und zwar bewusst: Maßgeblich sind nach Kriterium 5 DPMA und EUIPO, nicht das US-Register, und die Recherche dort steht für alle Kandidaten noch aus (Abschnitt 8). Ein endgültiger Ausschluss auf einen Treffer, den die drei oben schlicht noch nicht durchlaufen haben, wäre ungleiche Strenge. Everspan ist damit Risikokandidat, kein erledigter Fall — bestätigt die Markenrecherche die drei nicht, steht es wieder im Feld.

**Play-Titel-Budget** (Limit 30) für alle drei nachgerechnet:

| Untertitel           | Movepath | Tallyspan | Holdspan |
| -------------------- | -------: | --------: | -------: |
| `Bodyweight Tracker` |       28 |        29 |       28 |
| `Bodyweight Log`     |       24 |        25 |       24 |
| `Train & Track`      |       23 |        24 |       23 |

**Der Haken an Holdspan — zwei eigene Kriterien sprechen dagegen.**

1. **Kriterium 1 (übungsneutral).** „Hold“ benennt eine Trainingsform: Halten, Isometrie, Plank. Das ist dieselbe Bindung, für die _Repora_ in 3.4 abgewertet wurde („rep“ trägt Halte-Timer sprachlich nicht) — nur spiegelverkehrt: Holdspan trägt die Wiederholung nicht. Ein Name, der auf den Halte-Timer zeigt, bevorzugt eine Übungsart, und genau das schließt Kriterium 1 aus.
2. **Markennähe.** _Holdfast_ ist in 3.4 ausgeschieden, weil Holdfast Properties eine Marke für Software „for tracking and monitoring exercise“ hält — die Warenklasse dieses Produkts. Holdspan teilt den Stamm. Der Plan behandelt Stammnähe sonst als Risiko (drei „Keep“-Kandidaten in 3.4, Google Keep in Klasse 9); hier gilt nichts anderes.

**Einschätzung.** _Movepath_ liest sich am natürlichsten und ist als einziges klar übungsneutral — jede Übung ist Bewegung. _Tallyspan_ ist inhaltlich richtig (zusammenzählen über eine Spanne), klingt aber sperriger. _Holdspan_ hat die schönste Doppelbedeutung — der Halte-Timer wörtlich, die Streak übertragen — scheitert aber an den beiden Punkten oben; es steht nur noch hinten in der Reihe, falls die Markenrecherche die anderen beiden kippt.

**Überholt.** Alle drei Kandidaten dieses Abschnitts sind in **3.7** ausgeschieden. Der Abschnitt bleibt stehen, weil die Verfahrensbefunde daraus — DNS als reiner Ausschlusstest, ungleiche Strenge beim Sieben, Domain-Kriterium C — weiter gelten.

### 3.7 Die Runde nach dem Merge — Stand 2026-09-23

Nach dem Merge von #762 sind drei Dinge dazugekommen, die das Feld aus 3.6 vollständig geräumt haben.

**1. Die Produktrichtung hat sich geweitet.** „Langfristig wird die App evtl. zu einer ‚ich zähle irgendetwas in meinem Leben und halte die Statistik fest‘.“ Das trifft Kriterium 1 an der Wurzel und kehrt die Reihenfolge aus 3.6 um:

| Kandidat aus 3.6 | Stand                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Movepath         | **Fällt.** Seine ganze Begründung war „jede Übung ist Bewegung“ — eine gelesene Seite ist keine Bewegung |
| Holdspan         | Fällt, jetzt dreifach belastet                                                                           |
| Tallyspan        | Wurde kurzzeitig Favorit (_tally_ = Strichliste über irgendetwas), dann verworfen                        |

**2. Zwei Geschmacksentscheidungen.** Deutsche Namen scheiden aus (Stetwerk, Kerbstrich, Tagpensum, Zählwerk-Familie); der Stamm _tally_ scheidet aus. Damit fallen zusätzlich Tallyslate, Sticktally, Wolftally und Tallyo. Beides sind Setzungen des Auftraggebers, keine Kriterienbefunde — hier dokumentiert, damit spätere Runden die Namen nicht erneut vorschlagen.

**3. Ein belegter Store-Treffer.** _RepVision_ wurde vorgeschlagen und ist **vergeben**: „RepVision – PushUps Tracker“ (`com.hpt.repvision`) bei Google Play zählt laut Eintrag Liegestütze und Kniebeugen per Kamera-KI. Derselbe Name für dasselbe Produkt, inklusive Kamera-Autozähler — der eindeutigste Kriterium-6-Verstoß dieser ganzen Suche. Unabhängig davon wäre „Rep“ ohnehin gefallen: derselbe Grund, aus dem _Repora_ in 3.4 abgewertet und _RepStack_ ausgeschlossen wurde.

**Regel 1 aus 3.5 hat dabei einen zweiten, härteren Beleg bekommen.** `repcount.com` löst **nicht** auf — die App **RepCount** existiert trotzdem, unter `repcountapp.com`, in beiden Stores. Domain- und Store-Prüfung sind unabhängig, und keine ersetzt die andere. Talvio und Vantio waren der erste Beleg, RepCount ist der deutlichere.

#### Store-Check der verbliebenen fünf

Erstmals in diesem Plan für alle Kandidaten einer Runde gefahren, per Websuche:

| Kandidat      |  Z. | Bild                                                     | Befund                                                                                                                                                                              |
| ------------- | --: | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notchcard** |   9 | die Stempelkarte, die man einkerbt                       | **Kein Treffer.** Keine App, keine Marke, kein Unternehmen, kein benachbarter Stamm                                                                                                 |
| **Wolfsten**  |   8 | _wolf_ + _sten_ — Wolfram und tungsten, dasselbe Element | Store und Marke sauber; **offen: Wolfenstein**, ZeniMax Media, Reg. #4653929, live/registered, Computer & Software Products (Klasse 9)                                              |
| Cairnmark     |   9 | „leg deinen Stein dazu“                                  | **Cairn** existiert als Wander-Sicherheits-App mit Tourenaufzeichnung und Streckenstatistik — benachbarte Warenklasse. Dieselbe Stammnähe, wegen der Holdspan an Holdfast scheitert |
| Onerung       |   7 | „eine Sprosse nach der anderen“                          | **ONE running** bei Play, **ONE RUN** unter `onerun.app` — wer „Onerung“ hört, tippt „onerun“                                                                                       |
| Wolfstone     |   9 | Wolfsstein, lesbarer als Wolfsten                        | **Wolfstone**, schottische Celtic-Rock-Band seit 1989, eigenes Label, `wolfstone.co.uk` — Klasse 41, eine unserer drei. Dazu `.com` vergeben                                        |

**Etymologie zu Wolfsten**, weil sie die Markengeschichte trägt und belegbar ist: _tungsten_ kommt aus dem Schwedischen, _tung sten_ = schwerer Stein. Der deutsche Name desselben Elements ist **Wolfram**, von mittelalterlichen Bergleuten so genannt, weil das Erz das Zinn fraß „wie ein Wolf die Schafe“. Element 74 hat den höchsten Schmelzpunkt aller Metalle. Der Name ist damit zugleich der Vorname des Autors, ein Tier und ein Werkstoff — und als **willkürliche Marke** (kein beschreibender Bezug zur Ware) die durchsetzungsstärkste Kategorie für Kriterium 5. Genau das ist auch sein Preis: Er erklärt nichts, der Untertitel muss die Arbeit machen.

#### Aktuelles Feld

| Name          |  Z. | `.com` | `.de` | `.app` | Play-Titel mit `: Count & Track` |
| ------------- | --: | ------ | ----- | ------ | -------------------------------: |
| **Notchcard** |   9 | frei?  | frei? | frei?  |                               24 |
| **Wolfsten**  |   8 | frei?  | frei? | frei?  |                               23 |

„frei?“ heißt unverändert: keine DNS-Auflösung, kein Freigabebeweis.

#### Drei Grenzen dieser Prüfung, ausdrücklich

1. **Das Suchwerkzeug ist US-beschränkt.** Bei neun Sprachmärkten kann eine deutsche oder europäische App durchgerutscht sein.
2. **Eine Websuche ist keine Markenrecherche.** DPMA und EUIPO sind weiterhin nicht abgefragt; der Wolfenstein-Fund stammt aus dem US-Register.
3. **Kein Treffer ist kein Beweis.** Bei RepVision hat die Suche sofort angeschlagen — das belegt, dass sie greift, nicht dass Schweigen Freiheit bedeutet.

#### Was das Verfahren lehrt

Die Kollisionsprüfung hat die Rangfolge in dieser Runde **zum zweiten Mal** korrigiert: Erst hob die Produktaussage Tallyspan von Platz 2 auf Platz 1, dann hob der Store-Check Notchcard von Platz 3 auf Platz 1. Beide Male hatte ich zuvor nach Klang und Bild sortiert. **Klang rankt, Kollision entscheidet** — die Reihenfolge der Prüfungen gehört umgedreht: erst Store, dann Ästhetik.

### 3.8 Ablauf

1. Pro Richtung 5–8 Kandidaten sammeln.
2. Gegen Kriterien 1–3 filtern (Schreibtischarbeit, keine externen Abfragen).
3. Für die verbleibenden 3–5: Domain-, Marken- und Store-Recherche.
4. Entscheidung dokumentieren — dieser Plan wird mit dem gewählten Namen aktualisiert, danach werden die Phasen-Issues angelegt.
5. Domain **vor** Phase 2 registrieren — das ist der Punkt, ab dem der Name nach außen geht. Ein Rename ohne gesicherte Domain ist ein Rückrufrisiko.

**Ergebnis von Gate 0:** gewählter Name, registrierte Domain, Play-Strategie (A oder B), neue Kontaktadresse (`contact@<neue-domain>`). Die Domain-Entscheidung aus 3.5 ist mit 3.6 **gefallen** (Suchmethode A, Domain-Kriterium C) und steht hier nicht mehr offen. Offen bleiben zwei Prüfungen, beide aus Abschnitt 8: die Bestätigung der Verfügbarkeit beim Registrar und die Markenrecherche in den Klassen 9, 41 und 42.

---

## 4. Phasen

Reihenfolge ist bewusst: erst das Refactoring, das den eigentlichen Rename klein macht; dann Nutzersichtbares; Domain und Store zuletzt, weil sie am wenigsten reversibel sind.

### Phase 1 — Brand-Layer zentralisieren (vor dem Rename)

**Status: erledigt.** Konstanten, Nicht-i18n-Literale, Guard und die i18n-Platzhalter sind drin.

**Problem:** Es gibt heute **keine zentrale Marken-Konstante.** „Pushup Tracker“ steht 22-mal wörtlich in Prod-Quellen, `https://pushup-stats.com` als Literal in mindestens 8 Dateien (`dashboard-share.ts`, `achievement-celebration.service.ts`, `blog-article.component.ts`, `exercise-detail.component.ts`, `pushup-type-detail.component.ts`, `goal-reached-dialog`, `generate-feeds.js`, `generate-sitemap.js`). Ein Rename ohne diesen Schritt ist ein 250-Dateien-Suchen-und-Ersetzen mit hoher Fehlerquote.

**Erledigt:**

- `libs/stats/src/lib/models/brand.ts`, exportiert über `@pu-stats/models`: `BRAND_NAME`, `BRAND_DOMAIN` und die daraus zusammengesetzten `BRAND_URL`, `BRAND_CONTACT_EMAIL`, `BRAND_LOGO_URL`.
- Alle Nicht-i18n-Literale in Prod-Quellen umgestellt. Die lokalen `BASE_URL`-/`SHARE_URL`-Aliase sind aufgelöst statt umgebogen.
- Kontaktadresse in Impressum, Datenschutz und Über uns gebunden — sie stand als Text neben den i18n-Spans.
- **Guard-Test** `tools/src/brand-literal-guard.spec.js`: scannt `web/src` und `libs`, dazu Drift-Tests für den sw-push-Spiegel und die `BASE_URL` beider Generatoren.

**Zwei bewusste Ausnahmen**, beide durch den Guard nachgehalten:

- `libs/sw-push` spiegelt `BRAND_NAME` lokal. Der SW-Bundle bleibt frei von Cross-Package-Imports — dieselbe Entscheidung wie bei `SW_SUPPORTED_LOCALES`. Ein Barrel-Import würde den Übungskatalog in einen Service Worker ziehen, der wenige KB groß bleiben soll.
- `web/src/index.html` wird ausgeliefert, bevor Angular bootet, und kann nichts importieren.

**Der i18n-Schritt ist umgesetzt:** 52 Messages tragen die Marke jetzt als `$localize`-Platzhalter (`${BRAND_NAME}:brand:`) beziehungsweise als Template-Binding `{{ brandName }}`. `TRANSLATABLE_COPY` im Guard ist leer — die Marke steht in keiner übersetzbaren Zeichenkette mehr.

Die Platzhalter wurden auch in die acht Ziel-Locales nachgezogen, statt 52 × 8 Units neu übersetzen zu lassen: Wo sich die deutsche Quelle ausschließlich durch Literal → Platzhalter unterschied, ist das `<ph>`-Element ins Target übernommen und der Status auf `translated` belassen. Das bewahrt insbesondere die italienische Keyword-Arbeit an `seo.wiki.pushupTypes.title` (siehe [`docs/gotchas/i18n.md`](../docs/gotchas/i18n.md)), die eine Neuübersetzung zerstört hätte.

**Zwei Befunde für Phase 2**, beide vorbestehend und nicht durch diesen Schritt entstanden:

- **Mehrere Locales haben den Produktnamen übersetzt**, statt ihn stehen zu lassen — `es` sagt „Estadísticas de flexiones“, `zh` „俯卧撑追踪器“, `el` „στατιστικά του PushUp“. Diese Units bleiben bewusst auf `initial` und werden von der Übersetzungs-Routine gegen die neue Quelle neu erzeugt; mit Platzhalter kann die Marke dann nicht mehr wegübersetzt werden.
- **`seo.default.description` (alle acht Locales) und `app.title` (`no`) nennen die Marke, obwohl die deutsche Quelle das nicht tut.** Sie stehen auf `translated`, werden also von der Routine nicht angefasst und würden den alten Namen über den Rename hinweg behalten. Vor Phase 2 prüfen.

**Tests:** Guard-Test neu. Die markenbehafteten Specs blieben unverändert. Der Production-Build über alle neun Locales inklusive Prerender ist die eigentliche Absicherung der XLIFF-Änderung.

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

  Ein neuer Absatz über die Übungsbreite passt in **keine** der acht westlichen Locales, ohne dass anderswo gekürzt wird — in `it-IT` reicht es nicht einmal für ein längeres Wort. Der Rename selbst ist netto meist neutral, aber jedes Zeichen, das der neue Name über „Pushup Tracker“ hinausgeht, schlägt an jeder Nennung zu. `pnpm nx test tools` bricht bei Überschreitung, also fällt das in CI auf — aber erst nachdem die Übersetzungen schon geschrieben sind. Deshalb: Kürzungen **mit** dem neuen Text planen, nicht danach.

- Play-Grafiken neu erzeugen (`tools/src/store-graphics/`).
- Package-ID bleibt (Option A). Nur falls Gate 0 doch auf B fällt, kommen die drei Zusatzstränge aus Abschnitt 2.3 als eigenes Ticket dazu.

**Tests:** `pnpm nx test tools` deckt Listing-Längen und Play-Publish-Skripte ab (`play-listing-source.spec.js`, `publish-play-release.spec.js`).

---

### Phase 6 — Content und Nutzer-Kommunikation

**Arbeit:**

- 151 Content-Quelldateien unter `content/`: `heroImageCredit`-Frontmatter (10× je Sprache), Tag `Pushup Tracker app`, CTAs mit alter Domain. Deutsch ist Quelle — für die Fremdsprachen greift die Übersetzungs-Routine, außer bei reinen Namens-/URL-Ersetzungen, die sprachübergreifend identisch sind.
- `pnpm nx run tools:generate-content` (bzw. `node tools/src/generate-content.mjs`) — regeneriert die 151 abgeleiteten TS-Module unter `web/src/app/blog/generated` und die `*-content.generated.ts`. **Nie von Hand editieren.**
- Feeds regenerieren.
- **Feature-Announcement:** Neuer Eintrag in `ANNOUNCEMENTS` (`web/src/app/core/feature-announcement.service.ts`) mit frischer ID und einem kurzen Dialog: „Wir heißen jetzt X — hier ist warum, und das kann die App inzwischen alles.“ Erscheint einmal pro Account auf `/app`. Das ist laut `CLAUDE.md` Pflicht für nutzersichtbare Änderungen und hier besonders sinnvoll: Bestandsnutzer sollen die neue Marke nicht als fremde App erleben.
- **Landing-Page-Sektion** über die Übungsbreite, „Neu“-getaggt — dieselbe Regel.
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

| Risiko                                          | Wirkung                                                                                                                            | Gegenmaßnahme                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| SEO-Einbruch nach Domain-Wechsel                | Organischer Traffic auf 837 URLs                                                                                                   | 301 statt 302, pfadgleich, Search-Console-Adressänderung, alte Domains ≥12 Monate halten                                            |
| Play-Package-ID ist bereits gebunden            | Marke und ID dauerhaft auseinander                                                                                                 | Option A: Listing umbenennen, ID behalten — die ID ist nach außen unsichtbar                                                        |
| TWA-Verifikation bricht nach Domain-Wechsel     | App öffnet mit Browser-Chrome statt fullscreen                                                                                     | `assetlinks.json` auf neuer Domain **vor** dem APK-Update ausliefern; Redirect-Ausnahme testen                                      |
| Halber Rename (Name neu, Logo/Store alt)        | Wirkt wie Bug, beschädigt Vertrauen                                                                                                | Phase 2+3 zusammen releasen; Phase 4+5 dicht hintereinander                                                                         |
| 8 Locales laufen der deutschen Quelle hinterher | Fremdsprach-UI mischt alte und neue Marke                                                                                          | `sync-xliff-locales.mjs`-Fallbacks halten den Build grün; Routine-Lauf **vor** dem Release abwarten                                 |
| Bestandsnutzer erkennen die App nicht wieder    | Deinstallationen, schlechte Reviews                                                                                                | Announcement-Dialog (Phase 6) + Blog-Artikel; Icon-Formsprache erkennbar überführen                                                 |
| Markenrechtlicher Konflikt beim neuen Namen     | Erzwungener zweiter Rename — Totalschaden                                                                                          | Gate-0-Kriterium 5 ist blockierend, nicht optional                                                                                  |
| Neue Domain nicht in `NG_ALLOWED_HOSTS`         | SSR liefert 403, Seite komplett tot                                                                                                | Schritt 2 der Phase-4-Reihenfolge, vor dem Canonical-Umzug                                                                          |
| Push-Subscriptions sind origin-gebunden         | Erinnerungen können nach dem Origin-Wechsel ausfallen; Altbestand in Firestore ist über das normale Abmelden nicht mehr erreichbar | Subscriptions zum Cutover serverseitig aufräumen; auf dem neuen Origin gezielt zur Neuanmeldung auffordern; Spec dafür. Siehe unten |

**Zum Push-Risiko.** `libs/push/src/lib/push-subscription.store.ts` liest die Subscription aus der Service-Worker-Registrierung und schickt nur den `endpoint` an den Server; beim **normalen** Abmelden löscht die App genau den Endpoint, den sie **lokal** lesen kann. Ein Domainwechsel ist ein Origin-Wechsel: Auf dem neuen Origin gibt es keine Registrierung, also sehen alle Nutzer „nicht abonniert“.

Ein vollständiger Weg existiert allerdings: Das Callable `unsubscribeAllPushDevices` (`data-store/functions/src/functions-push.ts`) löscht über `deleteAllPushSubscriptions` sämtliche `pushSubscriptions/{uid}/subs` samt Elterndokument, und die Erinnerungsseite ruft es auf (`web/src/app/reminders/shell/reminders-page.component.ts`). Alte Endpoints bleiben also **nicht zwangsläufig** liegen — sie bleiben, solange dieser Weg nicht gegangen wird, und ein Nutzer, dem die App „nicht abonniert“ anzeigt, hat keinen Anlass dazu. `dispatchPushReminders` schickt derweil weiter dorthin. Ob dabei doppelt zugestellt wird, hängt daran, wie lange die alte SW-Registrierung im Browser überlebt; das ist zu testen, nicht anzunehmen. Dass der Store eine eigene `.invalid`-Zombie-Behandlung hat, zeigt, dass Endpoint-Rotation hier schon einmal teuer war.

Origin-gebunden sind außerdem `localStorage`, IndexedDB und die Firebase-Auth-Persistenz. Das ist bewusst **nicht** als Risiko geführt: Die Inhalte dort sind Theme, Coachmark-Flag, Zitat-Cache und ein laufender Workout-Run — alles, was zählt, liegt in Firestore.

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

1. **Name** — Kandidaten aus **3.7**: **Notchcard** und **Wolfsten**, beide ohne DNS-Auflösung auf allen drei TLDs und ohne Store-Treffer. Notchcard ist der unbelastete, Wolfsten der mit der stärkeren Geschichte und der offenen Wolfenstein-Frage. Das Feld aus 3.6 (Movepath, Tallyspan, Holdspan) ist vollständig ausgeschieden, Gründe in 3.7. Offen: Bestätigung beim Registrar und die Markenrecherche in den Klassen 9, 41, 42.
2. **Domain** — Verfügbarkeit prüfen und registrieren, **bevor** Phase 2 startet. Welche TLD, entscheidet der Registrar-Befund: Primär ist `.app` (Entscheidung aus 3.6), die `.com` wird mitgenommen, wenn sie frei ist, `.de` ergänzend nach Kriterium 4. Muss beim Registrar geschehen: RDAP war aus der Arbeitsumgebung nicht erreichbar, eine Verfügbarkeitsaussage von dort wäre geraten.

   **Geprüft und verworfen: eine Subdomain unter dem vorhandenen `wolsok.de`.** Der TWA-Wrapper verbirgt zwar die Adresszeile — aber nur, solange Digital Asset Links verifizieren, und die Android-App ist ohnehin der Wrapper, nicht das Produkt. Die Domain steht als **sichtbarer Text** in `profile-labels.ts` (CTA auf jedem öffentlichen Profil: „Selbst tracken – <domain>“) und in `public-profile-seo.ts` (Meta-Description, also das Google-Snippet) — genau auf den beiden Flächen, die Akquise und Empfehlung tragen. Dazu ist `.de` ein Geo-Signal und arbeitet gegen die EN-first-Positionierung aus 3.2. Gespart wären 10–50 €/Jahr; die SEO-Migration aus Phase 4 spart eine frische Subdomain **nicht**.

3. **Play-Lifetime-Installs** — nur bei null Installs gäbe Google die ID nach einer Löschung wieder frei. Das ist die einzige Zahl, die Option B noch günstiger machen könnte; ansonsten bleibt es bei Option A.
4. **Kontaktadresse** — `contact@<neue-domain>` einrichten; alte Adresse für die Übergangszeit weiterleiten (steht in Impressum und Datenschutz, also rechtlich relevant). **Entkoppelbar:** Der Bestand enthält bereits `wolsok.de`; eine Adresse dort löst diesen Punkt unabhängig vom Namensentscheid.
5. **Push-Subscriptions beim Origin-Wechsel** — siehe Risikotabelle. Braucht eine Entscheidung _vor_ Phase 4: serverseitig zum Cutover aufräumen, oder Altbestand auslaufen lassen und doppelte Zustellung in Kauf nehmen.
6. **Produktrichtung** — ist „zähl irgendetwas und halte die Statistik fest“ **Absicht** oder **Möglichkeit**? Davon hängt Kriterium 1 ab (siehe 3.1) und damit, ob ein domänenneutraler Name den schwächeren Fitness-Verkauf wert ist. **Unbeantwortet.**
7. **Logo-Richtung** — soll die Formsprache des alten Icons erkennbar bleiben (sanfterer Übergang) oder bewusst brechen?
8. **Route-Slug `/wiki/liegestuetz-typen`** — Empfehlung ist behalten; falls doch neutral, muss es in Phase 4 mit.
