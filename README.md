# Push-up Stats Service (Nx Monorepo)

Nx-Monorepo mit:

- **`web`**: Angular App mit **SSR + Hydration** und Angular Material Dark Theme
- **`api`**: Node.js API für `/api/stats` (Quelle: `pushups.csv`)

## Features

- Tages- und Stundenaggregation
- `dayIntegral` (kumuliert pro Tag)
- Deutsche UI-Labels wie im bisherigen Service
- KPI-Karten, Chart, Tabellenansicht

## CSV-Quelle

Standardmäßig wird gelesen aus:

- `/home/wolf/.openclaw/workspace/pushups.csv`

Anpassbar über Umgebungsvariable:

- `PUSHUPS_CSV_PATH=/pfad/zu/pushups.csv`

## Lokale Entwicklung

```bash
npm install

# API (Port 8787)
npx nx serve api

# Web (Angular SSR Dev Server)
npx nx serve web
```

## Builds

```bash
# Alles bauen
npx nx run-many -t build

# Nur Web (SSR Output)
npx nx build web

# Nur API
npx nx build api
```

## Tests & Lint

```bash
npx nx run-many -t lint
npx nx run-many -t test
```

## API

`GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`

Antwort enthält:

- `meta` (entries, days, total, granularity)
- `series` (daily oder hourly)
- `daily`
- `entries`
