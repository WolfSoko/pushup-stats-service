# pushup-stats-service — docker-compose

This repo runs two Node servers:

- **ssr** (Angular SSR) on `8789`
- **proxy** (reverse proxy) on `8787` _(optional when serving web directly)_

Data is stored in Firebase / Firestore (no local database required).

## Quick start

```bash
# from repo root
cp .env.example .env

docker compose up -d --build
```

Then open (default):

- http://127.0.0.1:18787 (redirects to /de)
- http://127.0.0.1:18787/en

If you want to bind to 8787 on the host:

```bash
# edit .env
PROXY_HOST_PORT=8787

# stop anything else using 8787 first
docker compose up -d
```

## Dev mode

This compose setup is production-like (built artifacts under `dist/`).
For local dev (HMR etc.), use `nx serve` or `nx run web:serve-local` (starts Firebase emulators).
