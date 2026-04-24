# Push-up Stats Service

**Live:** https://pushup-stats.de

Angular SSR Monorepo (Nx) mit Firebase Backend.

## Stack

- **web**: Angular 21, SSR, PWA, i18n (DE default `/de`, EN unter `/en`)
- **libs/stats**: Shared Models/Typen
- **libs/auth**: Firebase Auth (Google, Email/PW, anonym/Gast)
- **libs/data-access**: Firestore-Zugriff (Browser: direkt mit Auth; SSR: Demo-User für SEO-Preview)
- **libs/ads**: Google AdSense Integration
- **data-store**: Firestore Rules, Cloud Functions (Leaderboard, Admin)

## Lokale Entwicklung

```bash
pnpm install

# One-command local stack (Web + Firebase Emulator)
npx nx run web:serve-local

# Emulator wieder stoppen
npx nx run data-store:emulate:stop

# Gegen Live-Firebase (ohne Emulator)
npx nx run web:serve-live
```

## Tests & Qualität

```bash
npx nx run-many -t lint test build
```

## Deployment

Deployment ist CI-gated: nach grünem Build auf `main` fast-forwardet CI den `deploy` branch; Firebase Hosting (static) und Firebase App Hosting (SSR/Cloud Run) deployen automatisch von dort.

```bash
# Firestore Rules manuell deployen (Notfall)
cd data-store && firebase deploy --only firestore:rules

# Cloud Functions manuell deployen (Notfall)
cd data-store && firebase deploy --only functions
```

Details + PR-Preview-Setup: siehe [`AGENTS.md`](AGENTS.md) Abschnitt _CI/CD & Deployment_.

## i18n

- DE ist Default → `/` redirected 302 zu `/de` (oder `/en` bei `Accept-Language: en*`)
- EN unter `/en`
- Sprachumschaltung im UI preserved Pfad, Query und Hash

## SEO

- SSR für alle öffentlichen und privaten Routen aktiv
- Private Routen (`/app`, `/data`, `/analysis`) rendern Demo-Daten für Crawler
- `hreflang` Tags dynamisch via `SeoService`

## Admin-Bereich

Unter `/admin` (nur für Admin-User sichtbar). Funktionen:

- User-Liste mit Pushup-Statistiken
- Einzelne User löschen (mit Datenschutz-Option)
- Anonyme inaktive User in Bulk löschen

Admin-Rolle setzen (einmalig, nutzt Firebase Custom Claims):

```bash
node scripts/set-admin-claim.mjs <email-or-uid>
```

## TDD

1. **RED**: Test schreiben der fehlschlägt
2. **GREEN**: Minimaler Code bis Test grün
3. **REFACTOR**: Aufräumen ohne Verhalten zu ändern

```bash
npx nx affected -t test --codeCoverage
```

## Agent instructions

AI-Agent-Anweisungen (Architektur, Konventionen, Gotchas, Workflow) leben in [`AGENTS.md`](AGENTS.md). Claude Code und Copilot referenzieren diese Datei als Single Source of Truth.

## Bekannte Probleme

→ `docs/linux-wsl-known-issues.md`
