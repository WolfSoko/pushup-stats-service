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

## API

`GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`

Kompatibel zu vorher:

- `meta` (`entries`, `days`, `total`, `granularity`, ...)
- `series`
- `daily`
- `entries`
