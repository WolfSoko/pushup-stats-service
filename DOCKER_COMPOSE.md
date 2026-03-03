# pushup-stats-service — docker-compose

This repo runs three Node servers:

- **api** (Nest) on `8788`
- **ssr** (Angular SSR) on `8789`
- **proxy** (reverse proxy) on `8787` (public entry)

## Quick start

```bash
# from repo root
mkdir -p data
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

## Data persistence

`./data` is mounted into the API container at `/app/data` and stores:

- Keep this folder backed up (this is the durable state).
- For production, consider switching the bind mount to an absolute path.

- `pushups.db`
- `user-config.db`
- `pushups.csv` (optional)

## Dev mode

This compose setup is production-like (built artifacts under `dist/`).
For local dev (HMR etc.), use `nx serve`.
