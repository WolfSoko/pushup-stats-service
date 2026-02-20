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

## Firebase (Phase 1 Scaffold)

Im Browser kann die Firebase-Konfiguration über `window.__PUS_FIREBASE__` gesetzt werden:

```js
window.__PUS_FIREBASE__ = {
  apiKey: '... ',
  authDomain: '... ',
  projectId: '... ',
  appId: '... '
};
```

Sobald konfiguriert, übernimmt `UserContextService` den Firebase `uid` als `userId`.

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
