# Firebase Quick Start (5 Minutes)

TL;DR: Deploy frontend to Firebase Hosting with a minimal setup.

1. Create Firebase project (e.g., pushup-stats-firebase)
2. Install Firebase CLI and login
3. Initialize Firebase in project (Hosting + optional Functions)
4. Build frontend: npx nx build web --configuration=production
5. Deploy: firebase deploy

Notes:

- API can remain behind Tail/Tailscale; configure a rewrite if needed
- Firebase config (apiKey, authDomain, etc.) is client-side

---

_Last updated: 2026-02-21_
