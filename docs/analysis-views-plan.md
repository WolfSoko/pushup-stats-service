# Analyse-Seite: Aufteilung nach Übungsgruppen

Plan zur Aufteilung von `/analysis` in eine Übersicht und kategoriespezifische Detail-Ansichten.

## Zielbild

`/analysis` bleibt eine Route. Darin: `mat-tab-group` mit dynamischen Tabs:

**Übersicht** (immer sichtbar) · **Pushups** · **Bauch** · **Beine** · **Plank** · **Cardio** · **Kraft** · **Mobility**

Tabs ohne Einträge im aktuellen Zeitraum werden ausgeblendet (`kindOptionsRaw` → Kategorien-Set).

Designentscheidungen (mit Nutzer abgestimmt):

- Navigation: `mat-tabs` innerhalb `/analysis`, Tab-Wahl als Query-Param `?view=`.
- Trends (8 Wochen / 6 Monate): in Gruppen-Tabs **pro Gruppe gefiltert**, gleiche Datenbasis (kein zusätzlicher Firestore-Read).
- Übersicht-Inhalt: Kategorie-Vergleich (Bar/Pie) **plus** Kategorie-Karten mit Quick-Stats + Drilldown-Link.

---

## 1. Datenmodell-Bindung: Eintrag → Kategorie

Neuer Helper in `libs/stats/src/lib/models/`:

```ts
unifiedEntryCategoryId(entry: UnifiedEntry): ExerciseCategoryId
//  'pushup' kind   → 'pushup'
//  'exercise' kind → catalog.find(exerciseId).categoryId
```

Wird in `analysis.store.ts` als Basisfilter genutzt.

---

## 2. Store-Erweiterung (`web/src/app/stats/analysis.store.ts`)

Neuer State:

```ts
activeView: 'overview' | ExerciseCategoryId   // default 'overview'
```

Neuer Selector vor allen bisherigen computeds einziehen:

```ts
viewFilteredRows = computed(() =>
  activeView() === 'overview'
    ? rows()
    : rows().filter(e => unifiedEntryCategoryId(e) === activeView())
)
```

Alle bestehenden Aggregate (`chartSeries`, `typeBreakdown`, `bestSingleEntry`, `bestDay`, `currentStreak`, `longestStreak`, `setsDistribution`, `avgSetSize`, `heatmapData`) auf `viewFilteredRows` umstellen.

Trends pro Gruppe: `weekEntriesResource` und `monthEntriesResource` laden weiter den vollen 8-Wochen-/6-Monats-Bereich, aber `weekTrend()` / `monthTrend()` filtern jetzt zusätzlich nach `activeView`. Keine zusätzlichen Firestore-Reads.

Neue Selektoren für die Übersicht:

```ts
categorySummaries = computed(() =>
  EXERCISE_CATEGORIES
    .map(cat => ({
      categoryId: cat.id,
      nameKey: cat.nameKey,
      icon: cat.icon,
      totalReps, totalSets, todayReps,
      currentStreak, bestDay,
    }))
    .filter(s => s.totalReps > 0)
    .sort((a, b) => order)
)

categoryComparison = computed(() => /* { labels, reps, sets } für Bar-Chart */)
```

Methode: `setActiveView(view)` — synct mit `?view=` Query-Param.

---

## 3. Komponenten-Aufteilung

Aktueller Monolith `analysis-page.component.ts` (682 Zeilen) wird zerlegt:

| Datei                                          | Rolle                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `analysis-page.component.ts`                   | **Shell**: Filter-Bar oben + `mat-tab-group`, liest/schreibt `?view=`-Query-Param, switcht `activeView` im Store                     |
| `analysis-overview.component.ts` (neu)         | Übersicht-Tab: `<category-comparison-chart>` + Grid aus `<category-summary-card>`                                                    |
| `analysis-group-view.component.ts` (neu)       | Wiederverwendbare Detail-Ansicht: Chart + KPIs + Heatmap + Trends — keine Inputs, liest alles aus dem Store (der bereits gefiltert ist) |
| `category-summary-card.component.ts` (neu)     | `mat-card` mit Icon, Name, Quick-Stats, Button `(click)="select.emit(categoryId)"`                                                   |
| `category-comparison-chart.component.ts` (neu) | Horizontaler Bar-Chart (Chart.js) — Reps pro Kategorie, mit Sets als sekundäre Achse oder Toggle                                     |

Filter-Bar (Datumsbereich) bleibt **oberhalb** der Tabs → wirkt auf alle Ansichten.

Die bestehende „Kind"-Mehrfachauswahl entfällt durch die Tab-Auswahl. Empfehlung: in Übersicht und Gruppen-Tabs komplett entfernen. Falls später Sub-Filter pro Gruppe gewünscht (z. B. nur `legs.squats`), als Folge-Story.

---

## 4. Tab-Sichtbarkeit & Reihenfolge

```ts
visibleTabs = computed(() => {
  const cats = new Set(rows().map(unifiedEntryCategoryId))
  return EXERCISE_CATEGORIES
    .filter(c => cats.has(c.id))
    .sort((a, b) => a.order - b.order)
})
```

Übersicht-Tab immer Index 0. Tab-Wechsel → `setActiveView` → Query-Param-Update via `router.navigate([], { queryParams: { view }, queryParamsHandling: 'merge' })`.

---

## 5. Routing / Deeplinks

Keine neuen Routes. Query-Param `?view=overview|pushup|abs|legs|…` macht Tab-Auswahl shareable und browser-history-fähig. Init im Component-Constructor: `view` aus Snapshot lesen → `setActiveView`.

---

## 6. i18n

Neue XLIFF-IDs in `web/src/locale/messages.xlf` und `messages.en.xlf`:

- `@@analysis.tabs.overview` → „Übersicht" / „Overview"
- `@@analysis.overview.comparison.title` → „Vergleich nach Übungsgruppe"
- `@@analysis.overview.cards.viewDetails` → „Details ansehen"
- `@@analysis.overview.cards.todayReps`, `@@…totalReps`, `@@…bestDay`, `@@…streak`
- `@@analysis.overview.comparison.metric.reps` / `…sets` (Toggle)

Kategorienamen nutzen bestehende `EXERCISE_CATEGORIES[*].nameKey`.

---

## 7. Tests

| Bereich                       | Test                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unifiedEntryCategoryId`      | Pure-Function-Unit-Tests pro Kind                                                                                                                 |
| `analysis.store`              | `activeView` schaltet `viewFilteredRows`, KPIs ändern sich entsprechend; `categorySummaries` filtert leere Kategorien; `weekTrend` / `monthTrend` kategoriegefiltert |
| `category-summary-card`       | Rendert i18n Name + Stats; Klick emittiert `categoryId`                                                                                           |
| `category-comparison-chart`   | Mappt `categoryComparison` korrekt auf Chart.js dataset                                                                                           |
| `analysis-page` Shell         | Tabwechsel updated Query-Param und `activeView`; `?view=abs` initialer Snapshot wird übernommen; nur Tabs mit Daten sind sichtbar                 |
| Smoke                         | Wechsel zwischen Tabs ändert KPIs ohne Reload                                                                                                     |

Jeweils Given-When-Then; `TestBed` / `render`; `PLATFORM_ID: 'server'` falls Store mit Timer-Hook erweitert wird (aktuell nicht der Fall).

---

## 8. Lieferplan (sequenzielle Commits — alle mit Tests)

1. **Helper + Store-Refactor**: `unifiedEntryCategoryId`, `activeView`, `viewFilteredRows`; bestehende computeds umhängen; Trends kategoriegefiltert.
2. **Overview-Daten**: `categorySummaries`, `categoryComparison` im Store.
3. **Komponenten extrahieren**: `analysis-group-view` aus dem Monolithen herausziehen, Shell schlanker machen — noch ohne Tabs.
4. **Tabs einbauen**: `mat-tab-group`, `visibleTabs`, Query-Param-Sync.
5. **Overview-Tab**: `analysis-overview` + `category-summary-card` + `category-comparison-chart`. Drilldown-Click setzt Tab.
6. **i18n + XLIFF-Sync** (`pnpm nx run web:extract-i18n` und englische Übersetzungen pflegen).
7. **Pre-Push-Checks**: `pnpm nx affected -t=lint,test,build -c=production --parallel=3`.

---

## Risiken / Trade-offs

- **Filter-State teilen über Tabs:** ein gemeinsamer Store hält den Date-Range stabil — gewollt; Tab-Wechsel fühlt sich wie Filter, nicht wie Navigation an.
- **Chart-Performance:** `viewFilteredRows` ist `computed` und nur bei Änderung neu berechnet — unkritisch.
- **Bestehender „Kinds"-Filter:** Wird in Gruppen-Tabs redundant; entfällt komplett.
- **Trends weiterhin auf vollem 8-Wochen-Window-Read:** Mehr Daten geladen als pro Tab nötig, aber bestehende Resource bleibt unverändert — kein zusätzlicher Lese-Cost.

---

## Referenzen

- `web/src/app/stats/shell/analysis-page.component.ts` (aktueller Monolith)
- `web/src/app/stats/analysis.store.ts` (Store, der erweitert wird)
- `libs/stats/src/lib/models/exercise.models.ts` (Kategorien-Enum)
- `libs/stats/src/lib/models/exercise.catalog.ts` (Kategorien-Metadaten + i18n-Keys)
- `libs/stats/src/lib/models/unified-entry.models.ts` (Eintragsmodell)
- `web/src/app/app.routes.ts` (Routing)
