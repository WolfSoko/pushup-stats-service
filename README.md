# Push-up Stats Service (Nx Monorepo)

Produktionsnahe Nx-Architektur mit:

- **web**: Angular App (deutsche UI, Dark Theme)
- **api**: Node.js API mit kompatiblem Vertrag auf `GET /api/stats`
- **libs/stats-models**: Shared Models/Typen
- **libs/stats-data-access**: API Service (Datenzugriff)

## UI-Architektur (Smart/Presentational)

- **Smart Container**: `StatsDashboardComponent`
- **Presentational Components**:
  - `FilterBarComponent`
  - `KpiCardsComponent`
  - `StatsChartComponent` (Chart.js statt Canvas-Handcode)
  - `StatsTableComponent`

## Lokale Entwicklung

```bash
npm install
npx nx serve api
npx nx serve web
```

## Qualitätssicherung

```bash
npx nx run-many -t lint test build
```

## TDD-Guardrails (RED/GREEN/REFACTOR)

Für neue Features gilt ab jetzt verbindlich:

1. **RED**: zuerst Test schreiben, der fehlschlägt
2. **GREEN**: minimalen Code schreiben, bis der Test grün ist
3. **REFACTOR**: aufräumen, ohne Verhalten zu ändern

### Mini-Checkliste vor Commit

- [ ] Für jede neue/angepasste public Methode gibt es einen passenden Testfall
- [ ] Bei Bugfix: Test reproduziert den Bug zuerst (RED)
- [ ] `npx nx run stats-data-access:test --codeCoverage` (bei Data-Access-Änderungen)
- [ ] `npx nx run web:test --codeCoverage` (bei Web-Änderungen)
- [ ] `npx nx run api:test --codeCoverage` (bei API-Änderungen)
- [ ] Erst danach refactoren und committen

## API

`GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`

Kompatibel zu vorher:

- `meta` (`entries`, `days`, `total`, `granularity`, ...)
- `series`
- `daily`
- `entries`
