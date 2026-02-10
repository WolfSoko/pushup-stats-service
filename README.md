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

# Terminal 1: API (Express, Port 8787)
npx nx serve api

# Terminal 2: Web (Angular SSR Dev Server mit Proxy /api -> :8787)
npx nx serve web
```

Hinweis: Falls Port `8787` belegt ist, API mit anderem Port starten:

```bash
PORT=8788 npx nx serve api
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
