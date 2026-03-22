# Firebase Deployment

**Projekt:** `pushup-stats`
**Live-URL:** https://pushup-stats.de

## Voraussetzungen

- Firebase CLI: `npm install -g firebase-tools`
- Eingeloggt: `firebase login`
- Service Account Key: `~/.firebase/pushup-stats-firebase-adminsdk-fbsvc-*.json`

## Firestore Rules deployen

```bash
cd data-store
firebase deploy --only firestore:rules
```

## Cloud Functions deployen

```bash
cd data-store
firebase deploy --only functions
# oder einzelne Function:
firebase deploy --only functions:adminListUsers
```

## App Hosting (SSR)

Das Deployment läuft über Firebase App Hosting (automatisch via GitHub Push auf `main`).
Manuell triggern über die Firebase Console → App Hosting.

## Umgebungen

| Umgebung   | Firebase Projekt       | URL                            |
| ---------- | ---------------------- | ------------------------------ |
| Production | `pushup-stats`         | https://pushup-stats.de        |
| Staging    | `pushup-stats-staging` | (via `fire.config.staging.ts`) |
| Lokal      | Firebase Emulator      | http://localhost:4200          |

## Nützliche Befehle

```bash
# Logs ansehen
firebase functions:log

# Emulator starten
npx nx run data-store:emulate

# Admin-Rolle setzen
GOOGLE_APPLICATION_CREDENTIALS=~/.firebase/pushup-stats-firebase-adminsdk-fbsvc-e502979fa7.json npx tsx scripts/set-admin-role.ts

# Demo-Daten seeden
DEMO_USER_ID=aqgzwSbhudRLrluz1zBSW3XQx013 \
GOOGLE_APPLICATION_CREDENTIALS=~/.firebase/pushup-stats-firebase-adminsdk-fbsvc-e502979fa7.json \
npx tsx scripts/seed-demo-data.ts
```

## Rollback

Firebase Hosting: Console → App Hosting → vorherigen Release aktivieren.
Cloud Functions: Git Revert + erneut deployen.

---

_Zuletzt aktualisiert: 2026-03-22_
