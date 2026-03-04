# Push-up Stats Service (Nx Monorepo)

Produktionsnahe Nx-Architektur mit:

- **web**: Angular App (deutsche UI, Dark Theme)
- **api**: Node.js API mit kompatiblem Vertrag auf `GET /api/stats`
- **libs/stats-models**: Shared Models/Typen
- **libs/stats-data-access**: Datenzugriff (Browser: Firestore direkt, SSR: REST-Fallback)

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

# One-command local stack (Web + Firebase Emulator)
npx nx run web:serve-local

# Emulator wieder stoppen
npx nx run data-store:emulate:stop

# Durchstich gegen Live-Firebase (ohne Emulator)
npx nx run web:serve-live
```

## Qualitätssicherung

```bash
npx nx run-many -t lint test build
```

## Production / Daemon (systemd --user)

### i18n Deployment (de: `/de`, en: `/en`) - DE is default `/` handled das redirect

- **SSR**: `node dist/web/server/server.mjs` (PORT=8789)
- **Front Proxy**: epress, Routing nach api/ssr

Routing-Anforderungen:

- Cookie `language` hat Priorität vor `Accept-Language`
- Deutsch ist Default auf `/`
- Englisch liegt auf `/en`
- `/api`, `/socket.io`, `/health` gehen immer an das DE-Backend

> Hinweis: Die bisherige Einzel-Unit `pushup-service.service` (Port 8787) ist damit obsolet bzw. wird durch nginx ersetzt.

Nützliche Befehle:

```bash
systemctl --user status pushup-service.service
systemctl --user restart pushup-service.service
journalctl --user -u pushup-service.service -f
```

## TDD-Guardrails (RED/GREEN/REFACTOR)

Für neue Features gilt ab jetzt verbindlich:

1. **RED**: zuerst Test schreiben, der fehlschlägt
2. **GREEN**: minimalen Code schreiben, bis der Test grün ist
3. **REFACTOR**: aufräumen, ohne Verhalten zu ändern

### Mini-Checkliste vor Commit

- [ ] Für jede neue/angepasste public Methode gibt es einen passenden Testfall
- [ ] Bei Bugfix: Test reproduziert den Bug zuerst (RED)
- [ ] `npx nx affected -t test --codeCoverage`
- [ ] Erst danach refactoren und committen

## Datenzugriff (neu)

- **Browser-Runtime:** Pushups, Stats-Aggregation und User-Config laufen direkt über Firestore (`libs/data-access`).
- **SSR-Runtime:** nutzt ebenfalls Firestore direkt. Da im SSR-Kontext keine Authentifizierung vorliegt, werden keine Nutzerdaten geladen – die Services geben leere Ergebnisse zurück.

## Services, die optional geworden sind

Wenn nur Browser + Firebase genutzt wird (kein SSR/Legacy-Clients), können diese Dienste deaktiviert werden:

- `api` (Nest REST)
- `reverse-proxy`
