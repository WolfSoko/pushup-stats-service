# Multi-Exercise Roadmap

> Status: Proposed — generated 2026-05-05.
> Driver: Erweitern der App von "nur Liegestütze" auf ein generisches Übungssystem
> mit Bauch, Beine, Plank, Laufen, Kraftübungen und User-definierten Übungen.

## Vision

Heute ist die App vollständig auf "Pushup" verdrahtet: Collection-Name (`pushups`),
Feldname (`reps`), Cap (1–500), Catalog (`PUSHUP_TYPES`), Cloud-Function-Aggregation,
Leaderboard, Streak, Filter, i18n. Künftig:

- **Standard-Katalog von Übungen** (Pushups, Bauch, Beine, Plank, Pull-ups, Squats,
  Laufen …), kuratiert wie heute `PUSHUP_TYPES`.
- **Vier Measurement-Modi:** `reps` (Pushups, Bauch), `time` (Plank, Wandsitz),
  `distance` (Laufen, Radfahren), `weight` (Squats mit Hantel — Reps × kg).
- **Custom Exercises:** User können eigene Übungen anlegen (Name, Measurement-Type,
  Caps, Icon). Diese werden in Filter, Charts, Streaks, Leaderboards berücksichtigt.
- **Per-Exercise-Aggregation:** Jede Übung hat eigene Streaks, Best-Days, Daily-
  Goals, Heatmap, Period-Aggregates.
- **Per-Exercise-Leaderboards:** Top-10 pro Übung, kein einheitlicher "Reps-Topf".
- **Bestehende Userdaten** dürfen nicht verloren gehen — Migration der `pushups`-
  Collection auf das neue Schema.

## Datenmodell-Skizze (Ziel)

Drei-Ebenen-Hierarchie: **Kategorie → Übung → Variante (optional)**.

- **Kategorie** = breite Gruppe wie "Bauch", "Beine", "Pushups", "Plank", "Cardio".
  Wird zur Navigation und für Dashboard-Sektionen genutzt.
- **Übung** (`ExerciseDefinition`) = konkrete Tätigkeit (Crunches, Sit-ups, Squats,
  Lunges …). Jede Übung gehört zu genau einer Kategorie und hat genau einen
  Measurement-Type.
- **Variante** = Untergruppierung einer Übung, optional. Heute nur bei
  Pushups relevant ("Diamond", "Wide", "One-Arm" …); künftig auch bei Plank
  ("Forearm Plank", "Side Plank", "Hollow Hold").

```ts
// libs/stats/src/lib/models/exercise.models.ts
export type MeasurementType = 'reps' | 'time' | 'distance' | 'weight';

export type ExerciseCategoryId =
  | 'pushup' | 'abs' | 'legs' | 'plank' | 'cardio' | 'strength' | 'mobility';

export interface ExerciseCategoryInfo {
  id: ExerciseCategoryId;
  nameKey: string;             // i18n XLIFF-ID, z. B. '@@exercise.category.abs'
  icon: string;                // Material icon name
  order: number;               // Anzeige-Reihenfolge im Dashboard
}

export interface ExerciseDefinition {
  id: string;                  // 'pushup' | 'abs.crunches' | 'legs.squats' | custom uid
  categoryId: ExerciseCategoryId;
  ownerId?: string;            // null für Standard-Katalog, userId für Custom
  measurement: MeasurementType;
  // Caps pro Measurement (reps 1..500, durationSec 1..7200, distanceM 1..100000)
  min: number;
  max: number;
  unit: string;                // 'reps' | 's' | 'm' | 'kg'
  nameKey?: string;            // i18n XLIFF-ID für Standard-Übungen
  customName?: string;         // freier Name für User-Übungen
  icon?: string;
  variants?: readonly ExerciseVariant[];   // optional, z. B. nur bei Pushup/Plank
}

export interface ExerciseVariant {
  id: string;                  // 'diamond' | 'wide' | 'forearm' …
  nameKey: string;             // i18n XLIFF-ID
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ExerciseEntry {
  _id: string;
  userId: string;
  exerciseId: string;          // FK in ExerciseDefinition
  variantId?: string;          // optional FK in ExerciseDefinition.variants[]
  timestamp: string;
  // Genau eines der folgenden Felder ist gesetzt — durch Measurement bestimmt:
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;           // bei measurement='weight' kombiniert mit reps
  sets?: number[];             // optional, nur reps/weight
  source: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### Vorgesehener Standard-Katalog (Endausbau)

| Kategorie | Übungen | Measurement |
| --- | --- | --- |
| Pushup | Pushup (mit 13 Varianten — bestehender Katalog) | reps |
| Bauch | Crunches, Sit-ups, Beinheben, Russian Twist, Mountain Climbers | reps |
| Beine | Kniebeugen (Squats), Ausfallschritte (Lunges), Hüftheben (Glute Bridge), Wadenheben, Jump Squats, Wandsitz (`time`) | reps / time |
| Plank | Plank (Varianten: Standard, Forearm, Side, Hollow Hold) | time |
| Cardio | Laufen, Radfahren, Rudern | distance + optional time |
| Strength | Squat, Bench Press, Deadlift, Overhead Press | weight × reps |
| Mobility | Stretching-Routine | time |

**Firestore-Collections**

- `exerciseEntries/{id}` — neuer Name, neutralisiert.
- `exerciseDefinitions/{id}` — Standard-Katalog wird beim Build seeded; Custom
  Definitions liegen pro User unter dem gleichen Doc mit `ownerId`.
- `userStats/{userId}/perExercise/{exerciseId}` — Aggregate pro Übung. Globale
  Aggregate (Total-Streak, Total-Reps) entfallen oder werden als Sum-of-Reps
  separat geführt.
- `leaderboards/{exerciseId}_{period}` — eine Snapshot pro Übung × Periode.

**Migration-Strategie**

Cloud-Function-Backfill: Liest alle `pushups/*` Docs, schreibt sie 1:1 nach
`exerciseEntries/*` mit `exerciseId='pushup'` und `variantId=type`. Die alte
Collection bleibt **read-only** als Fallback bestehen, bis alle Klienten auf
neuem Schema lesen. Nach n Tagen: alte Collection löschen, Rule entfernen.

## Roadmap (Phasen)

### Phase 0 — Tracer-Bullet: Bauch + Beine end-to-end (DIESER PR)

**Ziel:** User legt einen Eintrag in einer der neuen Übungen (Crunches, Sit-ups,
Squats, Lunges …) an, sieht ihn in der Dashboard-Sektion seiner Kategorie und in
den eigenen Stats. Pushups bleiben unverändert verfügbar; das Pushup-Dashboard
ist die "obere" Sektion, darunter folgen Bauch und Beine.

**Phase-0-Katalog (Vorschlag)**

- Kategorie `pushup`: `pushup` (alles wie heute, inkl. 13 Varianten).
- Kategorie `abs`: `abs.crunches`, `abs.situps`, `abs.legraises`,
  `abs.russiantwist`, `abs.mountainclimbers` — alle reps.
- Kategorie `legs`: `legs.squats`, `legs.lunges`, `legs.glutebridge`,
  `legs.calfraises`, `legs.jumpsquats` — alle reps.
- Wandsitz (Wall-sit) bewusst rausgehalten, kommt mit Plank in Phase 1.

**Scope**

- [ ] **Modelle:** `ExerciseDefinition`, `ExerciseEntry`, `MeasurementType`,
      `ExerciseCategoryInfo`, `ExerciseVariant` neu anlegen. Variant-Struktur
      generisch — Pushup-Varianten wandern aus `PUSHUP_TYPES` in den
      generischen `variants`-Slot der `pushup`-Definition.
- [ ] **Validierung:** `validateExerciseEntry(entry, def)` prüft Measurement-
      Konsistenz (genau ein passendes Wertfeld gesetzt) und Caps.
- [ ] **Firestore Schema:** Neue Collection `exerciseEntries`. Pushups bleiben
      kurzfristig in der alten Collection — der neue Service liest beide und
      mappt `pushups/*` Docs on-the-fly auf `ExerciseEntry`-Form.
- [ ] **Security Rules:** Neue Rule für `exerciseEntries` mit Caps pro
      Measurement-Type (reps 1–500, sicherheitsseitig hardcoded; Custom-
      Übungen kommen erst in Phase 4).
- [ ] **API-Service:** `ExerciseFirestoreService` parallel zu
      `PushupFirestoreService`. Pushups-Service bleibt unverändert, damit
      Bestandscode weiterläuft.
- [ ] **Cloud Functions:** `applyDelta` bekommt einen `exerciseId`-Parameter
      und schreibt Aggregate nach `userStats/{userId}/perExercise/{id}`. Trigger
      auf `exerciseEntries/*` registriert.
- [ ] **Dashboard:** Bestehende Pushup-Sektion bleibt oben unverändert. Darunter
      eine neue Komponente `<exercise-category-section>` für jede Kategorie mit
      Daten — pro Kategorie Total der letzten 30 Tage, Top-Übung, einfache
      Eintragsliste.
- [ ] **Create-Entry-Dialog:** Neues "Übung"-Dropdown (Kategorie → Übung).
      Pushup-Pfad bleibt mit Varianten-Autocomplete; Bauch/Beine reduziert auf
      `reps` + `sets` + `timestamp`.
- [ ] **i18n:** Neue XLIFF-IDs für Kategorien (`@@exercise.category.abs`,
      `@@exercise.category.legs`, `@@exercise.category.pushup`) und für die
      10 neuen Übungen (`@@exercise.abs.crunches.name` etc.). Bestehende
      Pushup-Strings bleiben unverändert.
- [ ] **Tests:** Unit-Tests für Modelle, Validierung, Service. Component-Tests
      für Dialog und neue Dashboard-Sektion. Cloud-Function-Test für Delta mit
      zwei `exerciseId`s.
- [ ] **Doku:** `docs/architecture.md` Abschnitt "Exercises" + Hinweis in
      `AGENTS.md`.

**Out of Scope (Phase 0)**

- Plank (Time-Measurement, eigenes Varianten-Set) — eigene Phase wegen
  anderer UX/Validierung.
- Custom-User-Exercises.
- Per-Exercise-Leaderboards.
- Migration der alten `pushups` Collection in `exerciseEntries` — wir lassen
  beide Collections koexistieren, neuer Read-Layer abstrahiert das.
- Per-Exercise-Streaks (kommt in Phase 2 sobald die Aggregation steht).
- Trainingspläne pro Übung.
- Wandsitz und andere Time-Übungen (mit Plank in Phase 1).

### Phase 1 — Plank (Time-Measurement)

- `MeasurementType='time'` mit `durationSec` 1–7200.
- Eingabe-UI: mm:ss-Format + Stopper-Komponente.
- Aggregation in Cloud Function: `totalSec`, `bestHold`, `dailySec`.
- Charts: Zeit statt Reps auf Y-Achse.
- Validierung Security Rule: `durationSec` Cap pro Exercise.

### Phase 2 — Per-Exercise-Streaks & Daily-Goals

- `userStats/{userId}/perExercise/{exerciseId}` mit eigenem `currentStreak`,
  `bestStreak`, `dailyGoal`.
- UI: Pro aktiver Übung eigene Streak-Card auf dem Dashboard.

### Phase 3 — Cardio: Laufen (Distance + Time)

- `MeasurementType='distance'` mit `distanceM` und optionalem `durationSec`
  (Pace).
- UI: km/m-Toggle, optionale Strecke (GPX-Import lassen wir vorerst weg).

### Phase 4 — Custom Exercises (User-defined)

- UI für "Eigene Übung anlegen": Name, Measurement, Caps, Icon, Kategorie.
- Firestore: `exerciseDefinitions/{uuid}` mit `ownerId=userId`.
- Security Rule: `ownerId == auth.uid` darf erstellen/lesen.
- Filter / Catalog UI listet eigene Übungen unter "Meine Übungen".

### Phase 5 — Strength: Reps × Weight

- `MeasurementType='weight'` — Eintrag enthält `reps` und `weightKg`.
- Aggregation: Volume (Reps × kg), 1RM-Schätzung (Epley), PR-Tracking.
- Sets-Array bekommt optional `[reps: number, weightKg: number][]`-Tupel.

### Phase 6 — Per-Exercise-Leaderboards

- Eine Snapshot-Collection pro Übung × Periode.
- UI: Tab pro Übung in `/leaderboard`.
- Anti-Cheat-Caps pro Übung konfigurierbar.

### Phase 7 — Migration & Cleanup

- Cloud-Function-Job kopiert `pushups/*` → `exerciseEntries/*` mit
  `exerciseId='pushup'`.
- Alte Service-Wrapper entfernt.
- Alte Collection nach Sentry-Stichtag löschen.

## Companion-Fields (Strecke pro Zeit, Reps × Gewicht)

Manche Übungen brauchen **zwei** Wertfelder, nicht eins:

- **Laufen / Radfahren** = Strecke + Zeit (Pace). Datenmodell: `distanceM`
  als primärer Wert, `durationSec` als optionaler Companion.
- **Squats mit Hantel** = Reps × kg pro Set. Datenmodell: `reps` als
  primärer Wert, `weightKg` als verpflichtender Companion.

Der Validator (`validateExerciseEntry` in `exercise.models.ts`) erlaubt
seit dem Companion-Fix Fields jetzt aus einer expliziten Liste pro
Measurement:

| Measurement | Primär | Companion (optional) | Companion (required) |
| --- | --- | --- | --- |
| `reps` | `reps` | — | — |
| `time` | `durationSec` | — | — |
| `distance` | `distanceM` | `durationSec` | — |
| `weight` | `reps` | — | `weightKg` |

Caps liegen aktuell hartcodiert in `COMPANION_BOUNDS` (z. B. `weightKg`
0.25..500 mit Fließkomma für 2.5-kg-Inkremente, `durationSec` 1..86 400).
In Phase 4 (Custom-Übungen) wandern sie in `ExerciseDefinition`.

## Aufgeschobene Folgearbeiten (aus PR #289 Review)

Punkte, die im Phase-0-PR identifiziert, aber bewusst nicht direkt
gefixt wurden, weil ihr Aufwand den Tracer-Bullet sprengen würde:

- **Cloud-Function-Tests für `updateExerciseStatsOnEntryWrite`.** Die
  bestehenden Branches (first-create rebuild, version upgrade,
  timestamp-changed move, normaler Delta-Pfad, missing-doc rebuild)
  sind durch die Tests von `applyDelta` / `rebuildFromEntries` indirekt
  abgedeckt, aber dieser Trigger braucht eigene Tests, sobald Phase 1+
  weitere Measurement-Typen ergänzt.
- **Component-Tests für `ExerciseCategorySectionComponent`.** Der
  `summaries()`-Compute und der `openDialog()`-Erfolgs-/Fehlerpfad
  sollten Tests bekommen, sobald die Sektion mehr als reine Read+Add-
  Logik enthält (Streaks, Filter, Charts).
- **Per-Index-`aria-label`s im Eintrag-Dialog.** "Set 2 entfernen" /
  "Set 2 hinzufügen" statt der heute generischen Labels braucht eine
  ICU-MessageFormat-i18n-Erweiterung über alle 9 Locales — kein
  funktionaler Fix.
- **Codegen für Catalog-Caps ↔ Firestore-Rule.** Heute pflegen wir die
  reps-Caps an zwei Stellen (Catalog + Rule). Sobald Phase 4 (Custom-
  Übungen) variable Caps einführt, brauchen wir entweder eine
  generierte Rule oder eine Build-Time-Assertion.
- **Generische Anzeige-Logik in der Section.** `totalReps30d` und
  `last.reps` setzen Phase-0-Reps-only voraus. Wenn Phase 1 (Plank /
  Time) landet, muss die Sektion via `measurementValueField()` die
  passende Spalte rendern.

## Cross-cutting Tracks (über mehrere Phasen)

Folgearbeiten, die nicht in eine einzelne Tracer-Bullet-Phase passen, weil sie
quer durch die App schneiden. Sie laufen parallel zu den Phasen oder werden
zwischen ihnen eingeschoben.

### Track UI-1 — Historie für alle Übungen

**Status:** offen, sollte direkt nach Phase 0 starten.

Die `/entries` Seite (`entries-page.component.ts` + `EntriesStore`) liest
heute ausschließlich aus der `pushups`-Collection. Solange Sit-ups und
Kniebeugen nicht dort auftauchen, ist die Historie für die neuen Übungen
unsichtbar — User können einen Eintrag anlegen, aber nicht wiederfinden,
bearbeiten oder löschen.

**Scope**

- `EntriesStore` zusätzlich aus `exerciseEntries` laden und beide
  Quellen in eine vereinheitlichte Liste mergen (`PushupRecord` →
  `ExerciseEntry`-Form mit `exerciseId='pushup'`).
- `StatsTableComponent` bekommt eine "Übung"-Spalte (Kategorie-Icon +
  lokalisierter Name), die für Pushup wie heute den `variantType`
  zeigt, für andere Übungen den Exercise-Namen.
- Filter-Bar: zusätzlicher Multi-Select "Übung" (Pushup, Bauch-…,
  Beine-…). Default = alle Übungen.
- Edit-Flow: Pushups öffnen den existierenden Pushup-Dialog,
  Exercise-Entries den neuen `ExerciseEntryDialogComponent`.
- Tests: Service-Spec für gemerge'te Quellen, Component-Spec für
  Filter-Verhalten.

**Out of Scope**

- Bulk-Operationen (Massenlöschen über Übungen hinweg) — kommt mit
  Phase 2 (Per-Exercise-Streaks), wenn das Mental-Modell pro Übung
  steht.

**Offene Fragen**

- Sortierung bei mixed Übungen: chronologisch absteigend ist klar,
  aber was ist mit gleichzeitigen Einträgen? Tiebreaker via
  Exercise-Name oder Eingabereihenfolge?

### Track UI-2 — Analyse mit Übungs-Filter und Measurement-spezifischen Graphen

**Status:** offen, hat Abhängigkeiten zu Phase 1 (Plank) und Phase 3
(Cardio). Filter-Teil kann früher als die neuen Graphen.

Die `/analysis` Seite (`analysis-page.component.ts`,
`AnalysisStore`, `StatsChartComponent`, `TypePieComponent`,
`SetsDistributionComponent`, `HeatmapComponent`) ist konsequent auf
reps und Pushup-Varianten gebaut. Der "TypePie" zeigt heute Pushup-
Varianten — das ergibt für Sit-ups oder Squats keinen Sinn, weil
Phase-0-Übungen keine Varianten haben. Die Y-Achse vom StatsChart
ist hartcodiert auf "Reps".

**Scope (Filter-Stufe — sobald Phase 0 in Production ist)**

- Übungs-Filter (Multi-Select wie in der Historie). Wenn nur eine
  Übung ausgewählt ist, schaltet der TypePie auf die Varianten dieser
  Übung um (heute: Pushup-Varianten; künftig: Plank-Varianten).
- Bei Multi-Select über Kategorien hinweg zeigt die Pie-Darstellung
  stattdessen die Verteilung pro Übungstyp.

**Scope (Graphen-Stufe — kommt mit Phase 1+/3+)**

- **Plank (time):** Y-Achse "Sekunden", Best-Hold-Linie, kumulative
  Haltezeit pro Tag/Woche statt Reps.
- **Cardio (distance + duration):** Pace-Diagramm (min/km über Zeit),
  Wochen-Distanz-Aggregat. Strecke-pro-Zeit braucht eine zweite
  Achse oder einen separaten "Pace"-Graph — bewusst NICHT auf einer
  Achse mit reps oder seconds mischen.
- **Strength (reps × weight):** Volumen pro Tag (= Σ reps·kg),
  1RM-Schätzung (Epley) pro Übung über Zeit, PR-Linie.
- **Heatmap:** bleibt grundsätzlich, gewichtet künftig optional auf
  Volume/Sekunden statt nur reps, abhängig von der ausgewählten Übung.

**Design-Entscheidungen, die wir treffen müssen**

- Ein Chart pro Übung (saubere Achsen) vs. ein "vereinheitlichtes
  Effort-Score"-Chart (skaliert reps/sek/m/kg auf eine Vergleichsachse —
  fragwürdige Semantik, aber praktisch für Streak-Visualisierung).
- Wechsel zwischen Übungen via Tabs (klare Fokussierung) vs.
  vertikales Stapeln (alles auf einen Blick, längere Seite).
- Sets-Distribution macht für Cardio keinen Sinn — komponentes
  per Measurement gewählt.

**Out of Scope**

- Vergleichs-Charts ("Pushups vs. Squats") — eigenes Track, sobald
  alle Measurement-Typen live sind.

### Track ARCH — Klare Modul-Interfaces

**Status:** offen, sollte vor Phase 4 (Custom Exercises) abgeschlossen
sein, weil dort die Schnittstellen zwischen Catalog, Stores und UI
am stärksten belastet werden.

Heute haben mehrere Module implizite Abhängigkeiten:

- `dashboard.store.ts` und `analysis.store.ts` lesen direkt aus
  `LiveDataStore`/`StatsApiService` und kennen das `PushupRecord`-Shape.
- `EntriesStore` und `EntriesPageComponent` teilen Filter-Zustand
  über Inputs, nicht über ein Filter-Interface.
- Stats-Components akzeptieren `PushupRecord[]` direkt, statt eine
  domain-neutrale `EntryView` Schnittstelle.

**Scope**

- `libs/stats/src/lib/models/` bekommt eine `EntryView` (Lese-Form,
  Measurement-aware), die UI-Components statt `PushupRecord`/
  `ExerciseEntry` konsumieren. Stores mappen am Rand auf `EntryView`.
- `libs/data-access` definiert ein einheitliches `EntryQueryService`-
  Interface (User + Date-Range + ExerciseIds → `EntryView[]`), das
  Pushup- und Exercise-Firestore-Service intern bündelt.
- Filter-State zentral (z. B. ein `FilterStore` oder Query-Param-
  Bridge), damit Historie und Analyse synchronisiert werden können.
- Public-API-Files (`libs/*/src/index.ts`) auditieren — nur
  Symbole exportieren, die von außen genutzt werden, alles andere
  privat halten.
- Diagramm + Erklärung in `docs/architecture.md` ergänzen.

**Out of Scope**

- Ein vollständiger Wechsel auf Hexagonal-/Ports-und-Adapters-
  Architektur — zu schwer für den aktuellen Reifegrad.

### Track MKT — Landingpage-Text + SEO

**Status:** offen, blockiert nicht andere Phasen, sollte aber kurz nach
Phase 0 (sit-ups + squats live) erfolgen, damit der Marketing-Text
das tatsächliche Produkt widerspiegelt.

Aktuell beschreiben die Landingpage und das `<meta>` ausschließlich
"Liegestütze tracken". Ab Phase 0 ist das eine Untertreibung; Suchanfragen
nach "Bauchtraining App", "Kniebeugen Tracker", später "Lauftracker" etc.
finden uns nicht.

**Scope**

- Hero-Text und Feature-Sektion in
  `web/src/app/marketing/shell/landing-page.component.{html,ts}`
  überarbeiten — "Multi-Exercise" als Kernversprechen, Pushups als
  flagship example.
- `<meta name="description">` und `<title>` pro Locale aktualisieren.
- `seo.service.ts` `keywords` erweitern: Bauchtraining, Beintraining,
  Plank, Squats, Calisthenics, später Laufen/Cardio.
- Strukturierte Daten (`schema.org/SportsActivityLocation` oder
  passender Type) prüfen.
- Sitemap: stellt sicher, dass die Wiki-Seiten zukünftiger Übungen
  korrekt indexierbar sind (heute SEO-Demo nur Pushups —
  siehe Risiken unten).
- A/B-Test-fähig vorbereiten: Variante A (Pushup-fokussiert),
  Variante B (Multi-Exercise-fokussiert), via GrowthBook-Flag falls
  vorhanden.
- Open-Graph / Twitter-Cards Bilder: ein generisches Multi-Exercise-
  Hero statt Pushup-only.

**Offene Fragen**

- Brand-Name "Pushup Stats Service" passt nicht mehr zum Multi-
  Exercise-Versprechen. Re-Branding ist ein separater Track —
  hier nur Texte, kein Logo / Domain-Wechsel.

## Risiken & Offene Fragen

- **Backwards-Compat von `userStats`:** Heute liegt das Aggregat als ein einziges
  Doc pro User. Wenn wir auf `perExercise/{id}` umstellen, brechen alle Read-
  Sites. Deshalb in Phase 0 nur **zusätzlich** schreiben, alte Felder bleiben.
- **Pushup-Variant-Type vs. Exercise:** `variantType` (Diamond/Wide/…) bleibt nur
  für `exercise.id='pushup'` relevant. UI muss das kontextabhängig zeigen.
- **Quick-Add-FAB & Notification-Quick-Log:** Hängen heute hart an Pushups. In
  Phase 0 belassen wir den Default auf Pushup. User kann später konfigurieren.
- **Leaderboard-Exclusion-Flag:** Bleibt user-global, nicht per-exercise.
- **Plank-Daten in Charts:** Y-Achse muss pro Übung anders skaliert werden — heute
  haben Charts harte Reps-Annahme.
- **Demo-User für SEO:** Pushup-only Demo-Daten reichen vorerst; sobald wir
  öffentliche Bauch/Beine-Seiten erzeugen, brauchen wir Demo-Einträge dort.
