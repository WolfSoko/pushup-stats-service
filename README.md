# Push-up Stats Service

Kleiner Node.js-Service für Liegestütz-Statistiken mit:

- Tagesaggregation aus `pushups.csv`
- API Endpoint: `/api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Web-UI mit Verlaufsgrafik und Kalenderfilter

## Start

```bash
node server.mjs
```

Standard-Port: `8787` (über `PORT` anpassbar).

## Tailscale Serve (Beispiel)

```bash
tailscale serve --service=svc:pushups --https=443 http://127.0.0.1:8787
```
