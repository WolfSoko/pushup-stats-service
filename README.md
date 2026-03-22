# Push-up Stats Service

**Live:** https://pushup-stats.de

Angular SSR Monorepo (Nx) mit Firebase Backend.

## Stack

- **web**: Angular 19, SSR, PWA, i18n (DE default `/de`, EN unter `/en`)
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

## Production (systemd --user)

Drei Services laufen als User-Units:

| Service                      | Port | Beschreibung                                            |
| ---------------------------- | ---- | ------------------------------------------------------- |
| `pushup-stats-reverse-proxy` | 8787 | Nginx – Entry Point, `/api` + `/socket.io` weiterleiten |
| `pushup-stats-api`           | 8788 | API-Backend                                             |
| `pushup-stats-ssr`           | 8789 | Angular SSR (server.mjs)                                |

```bash
# Status prüfen
systemctl --user status pushup-stats-reverse-proxy pushup-stats-api pushup-stats-ssr

# Deployment
git pull && docker compose build && docker compose up -d
```

## Firebase Deployment

```bash
# Firestore Rules
cd data-store && firebase deploy --only firestore:rules

# Cloud Functions
cd data-store && firebase deploy --only functions

# Hosting (wird automatisch via App Hosting deployed)
```

## i18n

- DE ist Default → `/` redirected 301 zu `/de`
- EN unter `/en`
- Sprachumschaltung via Cookie `lang`

## SEO

- SSR für alle öffentlichen und privaten Routen aktiv
- Private Routen (`/app`, `/data`, `/analysis`) rendern Demo-Daten für Crawler
- `hreflang` Tags dynamisch via `SeoService`

## Admin-Bereich

Unter `/admin` (nur für Admin-User sichtbar). Funktionen:

- User-Liste mit Pushup-Statistiken
- Einzelne User löschen (mit Datenschutz-Option)
- Anonyme inaktive User in Bulk löschen

Admin-Rolle setzen (einmalig):

```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.firebase/pushup-stats-firebase-adminsdk-fbsvc-e502979fa7.json npx tsx scripts/set-admin-role.ts
```

## TDD

1. **RED**: Test schreiben der fehlschlägt
2. **GREEN**: Minimaler Code bis Test grün
3. **REFACTOR**: Aufräumen ohne Verhalten zu ändern

```bash
npx nx affected -t test --codeCoverage
```

## Bekannte Probleme

→ `docs/linux-wsl-known-issues.md`
