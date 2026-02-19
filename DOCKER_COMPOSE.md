# pushup-stats-service — docker-compose

This repo runs three Node servers:

- **api** (Nest) on `8788`
- **ssr** (Angular SSR) on `8789`
- **proxy** (reverse proxy) on `8787` (public entry)

## Quick start

```bash
# from repo root
mkdir -p data
docker compose up --build
```

Then open:

- http://127.0.0.1:18787

## Data persistence

`./data` is mounted into the API container at `/app/data` and stores:

- `pushups.db`
- `user-config.db`
- `pushups.csv` (optional)

## Dev mode

This compose setup is production-like (built artifacts under `dist/`).
For local dev (HMR etc.), use `nx serve`.
