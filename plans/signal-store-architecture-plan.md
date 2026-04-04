# Signal Store Architektur-Plan

> **Ziel:** Jedes Modul bekommt einen klaren signalStore als Single Source of Truth.
> Saubere Trennung: **Zustand** (Store) | **Datenbankzugriff** (API-Services) | **Darstellung** (Components).
> Zustandsuebergaenge bilden Domain-Logik ab.

## Uebersicht

| Phase | Modul | Store | Ebene | Status |
|-------|-------|-------|-------|--------|
| 1 | ads | `AdsStore` | root | Offen |
| 2 | motivation | `MotivationStore` | root | Offen |
| 3 | data-access | `LiveDataStore` | root | Offen |
| 4 | data-access | `LeaderboardStore` | root | Offen |
| 5 | web/stats | `DashboardStore` | component | Offen |
| 6 | web/analysis | `AnalysisStore` | component | Offen |
| 7 | web/entries | `EntriesStore` | component | Offen |

---

## Architektur-Prinzipien

### Schichten-Modell

```
+-----------------------+
|     UI Component      |  Nur Template-Binding + User-Events
|  (Smart / Dumb)       |  Injiziert Store, keine eigene Logik
+-----------------------+
         |
+-----------------------+
|     Signal Store      |  Zustand + Zustandsuebergaenge
|  withState / withMethods / withComputed
|  Domain-Core-Logik    |  Entscheidet WAS passiert
+-----------------------+
         |
+-----------------------+
|     API Service       |  Pure Datenbankzugriffe
|  (Firestore, REST)    |  Kein eigener State, nur Methoden
+-----------------------+
```

### Konventionen

1. **Root-Store** (`providedIn: 'root'`): Globaler Modulzustand (Auth, Ads, Reminders)
2. **Component-Store** (kein `providedIn`): UI-spezifischer Zustand (Dashboard, Analysis, Entries)
3. **API-Services**: Stateless, returnen Promises/Observables - kein Signal, kein State
4. **Computed Signals**: Abgeleiteter Zustand lebt im Store, nicht in der Component
5. **Resources**: Leben im Store, nicht in der Component - Store wrapped resource() und exponiert Daten als computed
6. **Effects**: Side Effects (Reload, Navigation, Snackbar) bleiben in der Component oder in Orchestration-Services

### Naming

- `XxxStore` fuer signalStore (z.B. `AdsStore`, `DashboardStore`)
- `XxxApiService` fuer API-Zugriffe (z.B. `StatsApiService`)
- Feature-File: `xxx.store.ts`

---

## Phase 1: AdsStore (Klein)

### Ist-Zustand
- `AdsConfigService`: 5x `toSignal()` auf Firebase Remote Config Observables + `init()` Methode
- `AdsConsentStateService`: 1 einfacher `signal()` fuer Consent

### Soll-Zustand
Beide Services in einen `AdsStore` konsolidieren:

```typescript
// libs/ads/src/lib/ads.store.ts
export const AdsStore = signalStore(
  { providedIn: 'root' },
  withState({
    enabled: false,
    dashboardInlineEnabled: false,
    adClient: '',
    dashboardInlineSlot: '',
    landingInlineSlot: '',
    targetedAdsConsent: true,
    initialized: false,
  }),
  withComputed(/* abgeleitete Werte */),
  withMethods(/* init(), setConsent() */),
  withHooks({ onInit: /* Remote Config Listener + Consent Restore */ })
);
```

### Dateien
- `libs/ads/src/lib/ads.store.ts` - NEU
- `libs/ads/src/lib/ads-config.service.ts` - ENTFERNEN
- `libs/ads/src/lib/ads-consent-state.service.ts` - ENTFERNEN
- `libs/ads/src/index.ts` - Exports aktualisieren
- Alle Consumer: `AdsConfigService`/`AdsConsentStateService` -> `AdsStore` ersetzen

### Consumer (muessen angepasst werden)
- `web/src/app/stats/shell/stats-dashboard.component.ts` - inject(AdsConfigService)
- `web/src/app/stats/shell/analysis-page.component.ts` - inject(AdsConfigService)
- `web/src/app/marketing/shell/landing-page.component.ts` - inject(AdsConfigService)
- `web/src/app/settings/` - inject(AdsConsentStateService)
- `web/src/app/app.config.ts` oder `app.ts` - AdsConfigService.init()

### Akzeptanzkriterien
- [ ] Ein einziger `AdsStore` verwaltet allen Ads-Zustand
- [ ] `AdsConfigService` und `AdsConsentStateService` existieren nicht mehr
- [ ] Alle Konsumenten nutzen `AdsStore`
- [ ] Remote Config Werte werden reaktiv aktualisiert
- [ ] Build + Lint + Tests bestehen

---

## Phase 2: MotivationStore (Klein-Mittel)

### Ist-Zustand
- `MotivationQuoteService`: Promise-basiert, private `inFlightFetch`, localStorage-Cache
- Opaker Zustand, keine Signals, kein reaktives Interface

### Soll-Zustand

```typescript
// libs/motivation/src/lib/motivation.store.ts
type MotivationState = {
  quotes: string[];
  loading: boolean;
  error: string | null;
  cacheDate: string | null;    // ISO date string, wann zuletzt geladen
};

export const MotivationStore = signalStore(
  { providedIn: 'root' },
  withState<MotivationState>({
    quotes: [],
    loading: false,
    error: null,
    cacheDate: null,
  }),
  withComputed((store) => ({
    todayQuote: computed(() => store.quotes()[0] ?? null),
    hasCachedQuotes: computed(() => store.cacheDate() === todayIso()),
  })),
  withMethods(/* loadQuotes(userId), restoreFromCache() */),
  withHooks({ onInit: /* Cache wiederherstellen */ })
);
```

### Dateien
- `libs/motivation/src/lib/motivation.store.ts` - NEU
- `libs/motivation/src/lib/motivation-quote.service.ts` - Reduzieren auf reinen API-Service (nur fetch, kein Cache-State)
- `libs/motivation/src/index.ts` - Exports aktualisieren
- Consumer: `MotivationQuoteService.getTodayQuote()` -> `MotivationStore.todayQuote()`

### Consumer
- `web/src/app/stats/shell/stats-dashboard.component.ts` - `motivationService.getTodayQuote()`
- `libs/reminders/src/lib/reminder.service.ts` - `motivationService.getTodayQuotes()`

### Akzeptanzkriterien
- [ ] Cache-Zustand (Quotes, Ladezustand, Fehler) ist im Store explizit sichtbar
- [ ] `MotivationQuoteService` wird zu reinem API-Service ohne eigenen State
- [ ] Store laedt Quotes proaktiv beim Init (falls Cache abgelaufen)
- [ ] Build + Lint + Tests bestehen

---

## Phase 3: LiveDataStore (Mittel)

### Ist-Zustand
- `PushupLiveDataService`: Signal-basiert, Firestore onSnapshot -> `entries` Signal
- `PushupLiveService`: Signal-basiert, Firestore onSnapshot -> `updateTick` Signal
- Zwei separate Services mit nahezu identischem Pattern (auth effect + Firestore listener)

### Soll-Zustand

```typescript
// libs/data-access/src/lib/live/live-data.store.ts
type LiveDataState = {
  entries: PushupRecord[];
  connected: boolean;
  updateTick: number;
};

export const LiveDataStore = signalStore(
  { providedIn: 'root' },
  withState<LiveDataState>({
    entries: [],
    connected: false,
    updateTick: 0,
  }),
  withMethods(/* interne Firestore-Listener-Verwaltung */),
  withHooks({ onInit: /* Auth-abhaengiger Firestore Listener */ })
);
```

### Dateien
- `libs/data-access/src/lib/live/live-data.store.ts` - NEU
- `libs/data-access/src/lib/live/pushup-live-data.service.ts` - ENTFERNEN
- `libs/data-access/src/lib/live/pushup-live.service.ts` - ENTFERNEN
- `libs/data-access/src/index.ts` - Exports aktualisieren

### Consumer
- `web/src/app/stats/shell/stats-dashboard.component.ts` - PushupLiveService -> LiveDataStore
- `web/src/app/stats/shell/entries-page.component.ts` - PushupLiveDataService -> LiveDataStore

### Akzeptanzkriterien
- [ ] Ein einziger `LiveDataStore` statt zwei Services
- [ ] `entries`, `connected`, `updateTick` in einem Store
- [ ] Firestore Listener wird korrekt auf-/abgebaut bei Auth-Wechsel
- [ ] Browser-only Guard bleibt erhalten (kein SSR Firestore)
- [ ] Build + Lint + Tests bestehen

---

## Phase 4: LeaderboardStore (Klein-Mittel)

### Ist-Zustand
- `LeaderboardPageComponent`: eigenes `leaderboardResource` + period Signal + 3 computeds
- `LandingPageComponent`: **dupliziertes** `leaderboardResource` + period Signal + 3 computeds
- Identische Logik an zwei Stellen

### Soll-Zustand

```typescript
// libs/data-access/src/lib/leaderboard/leaderboard.store.ts
type LeaderboardState = {
  data: Map<LeaderboardPeriod, LeaderboardEntry[]> | null;
  loading: boolean;
  error: string | null;
};

export const LeaderboardStore = signalStore(
  { providedIn: 'root' },
  withState<LeaderboardState>({ data: null, loading: false, error: null }),
  withMethods(/* load() */),
  withComputed(/* entriesForPeriod, currentUserEntry */)
);
```

### Dateien
- `libs/data-access/src/lib/leaderboard/leaderboard.store.ts` - NEU
- `libs/data-access/src/index.ts` - Export hinzufuegen
- `web/src/app/leaderboard/shell/leaderboard-page.component.ts` - Resource entfernen, Store nutzen
- `web/src/app/marketing/shell/landing-page.component.ts` - Resource entfernen, Store nutzen

### Akzeptanzkriterien
- [ ] Leaderboard-Daten werden einmal geladen und geteilt
- [ ] Keine duplizierte Resource-Logik in Components
- [ ] Beide Pages nutzen `LeaderboardStore`
- [ ] Build + Lint + Tests bestehen

---

## Phase 5: DashboardStore (Gross)

### Ist-Zustand
`StatsDashboardComponent` ist die komplexeste Komponente:
- 3 eigene `resource()` Aufrufe (entries, allTime, userConfig)
- 10+ `computed()` Signale
- 3 `effect()` fuer Side Effects
- Direkter Zugriff auf `StatsApiService`, `MotivationQuoteService`, `UserConfigApiService`
- Mischung aus Datenanfragen, Zustandsberechnung und UI-Logik

### Soll-Zustand

```typescript
// web/src/app/stats/dashboard.store.ts
type DashboardState = {
  dailyGoal: number;
  todayQuote: string | null;
};

export const DashboardStore = signalStore(
  // Kein providedIn - Component-Level
  withState<DashboardState>({ dailyGoal: 100, todayQuote: null }),
  withProps(() => ({
    // Resources als Props
    entriesResource: ...,
    allTimeResource: ...,
  })),
  withComputed((store) => ({
    allTimeStats: ...,
    allTimeTotal: ...,
    entryRows: ...,
    currentStreak: ...,
    weekReps: ...,
    todayTotal: ...,
    goalProgressPercent: ...,
    lastEntry: ...,
    latestEntries: ...,
    loading: ...,
  })),
  withMethods(/* refreshAll(), loadQuote() */)
);
```

### Dateien
- `web/src/app/stats/dashboard.store.ts` - NEU
- `web/src/app/stats/shell/stats-dashboard.component.ts` - Auf Store reduzieren

### Prinzip
Die Komponente soll nur noch:
- Den Store injizieren
- Template-Bindings machen
- User-Events an Store-Methoden delegieren
- Side Effects (Dialog oeffnen, Snackbar) in der Komponente behalten

### Akzeptanzkriterien
- [ ] `StatsDashboardComponent` hat keine eigenen resources/computed mehr
- [ ] Alle Datenlogik lebt im `DashboardStore`
- [ ] Component < 80 Zeilen (nur Template-Wiring + UI-Events)
- [ ] Build + Lint + Tests bestehen

---

## Phase 6: AnalysisStore (Mittel)

### Ist-Zustand
`AnalysisPageComponent`:
- 2 `resource()` (stats, entries)
- 2 Filter-Signals (from, to)
- 7+ `computed()` Signale (stats, chartSeries, trends, etc.)

### Soll-Zustand

```typescript
// web/src/app/stats/analysis.store.ts
type AnalysisState = {
  from: string;
  to: string;
};

export const AnalysisStore = signalStore(
  // Component-Level
  withState<AnalysisState>({ from: '...', to: '...' }),
  withProps(/* resources */),
  withComputed(/* stats, chartSeries, granularity, trends, etc. */),
  withMethods(/* setRange(), resetFilters() */)
);
```

### Dateien
- `web/src/app/stats/analysis.store.ts` - NEU
- `web/src/app/stats/shell/analysis-page.component.ts` - Auf Store reduzieren

### Akzeptanzkriterien
- [ ] Filter-Logik und Trend-Berechnungen im Store
- [ ] Component nur noch Template-Wiring
- [ ] Build + Lint + Tests bestehen

---

## Phase 7: EntriesStore (Mittel)

### Ist-Zustand
`EntriesPageComponent`:
- 1 `resource()` (entries) + Live-Data Hybrid
- 6 Filter-Signals (from, to, source, type, repsMin, repsMax)
- Busy-State fuer CRUD-Operationen
- Hybrid Browser/SSR Logik

### Soll-Zustand

```typescript
// web/src/app/stats/entries.store.ts
type EntriesState = {
  from: string;
  to: string;
  source: string | null;
  type: string | null;
  repsMin: number | null;
  repsMax: number | null;
  busyAction: 'create' | 'update' | 'delete' | null;
  busyId: string | null;
};

export const EntriesStore = signalStore(
  // Component-Level
  withState<EntriesState>({ ... }),
  withComputed(/* rows, filteredRows, sourceOptions, typeOptions */),
  withMethods(/* createEntry, updateEntry, deleteEntry, setFilter */)
);
```

### Dateien
- `web/src/app/stats/entries.store.ts` - NEU
- `web/src/app/stats/shell/entries-page.component.ts` - Auf Store reduzieren

### Akzeptanzkriterien
- [ ] CRUD-Operationen + Filter-Logik im Store
- [ ] Browser/SSR Hybrid-Logik im Store gekapselt
- [ ] Component nur noch Template-Wiring
- [ ] Build + Lint + Tests bestehen

---

## Abhaengigkeitsgraph der Phasen

```
Phase 1 (AdsStore) ─────────────────────────────┐
Phase 2 (MotivationStore) ──────────────────────┐│
Phase 3 (LiveDataStore) ───────────────────────┐││
Phase 4 (LeaderboardStore) ──── unabhaengig    ││││
                                               ││││
Phase 5 (DashboardStore) ─── haengt ab von ────┘┘│
Phase 6 (AnalysisStore) ──── unabhaengig         │
Phase 7 (EntriesStore) ───── haengt ab von ──────┘
```

**Parallelisierbar:**
- Phase 1 + 2 + 4 koennen parallel laufen
- Phase 3 kann parallel zu 1+2 laufen
- Phase 5 nach 1+2+3
- Phase 6 unabhaengig (jederzeit)
- Phase 7 nach 3

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|-----------|
| Breaking Changes in Public API | Barrel-Exports beibehalten, alte Namen als Alias re-exportieren, in Folge-PR entfernen |
| SSR-Kompatibilitaet | Browser-Guards in Store-Hooks beibehalten (`isPlatformBrowser`) |
| Firebase Real-time Listener Lifecycle | `withHooks({ onDestroy })` fuer Cleanup nutzen |
| Resource Timing (Signal vs Resource) | Resources als `withProps` im Store, nicht als State |
| Modul-Boundary Regeln | Stores im gleichen Modul wie bisherige Services platzieren |

---

## Validierung pro Phase

Nach jeder Phase:
1. `pnpm nx run-many --target=lint` - Keine Lint-Fehler
2. `pnpm nx run-many --target=test` - Alle Tests gruen
3. `pnpm nx build web --configuration=development` - Build erfolgreich
4. Manueller Check: Keine regressions in betroffenen Features
