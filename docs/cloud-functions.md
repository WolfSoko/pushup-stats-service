# Cloud Functions

Overview and conventions for `data-store/functions/`. For deploy-path / IAM / delta-aggregation pitfalls, see [`gotchas/cloud-functions.md`](gotchas/cloud-functions.md).

## Project layout

- **Nx project `cloud-functions`:** TypeScript source in `data-store/functions/src/`, esbuild bundles to `data-store/functions-dist/`. Jest tests with `ts-jest`.
- **Pure logic extraction:** Keep Cloud Function business logic in separate pure modules (e.g. `user-stats-delta.ts`) for unit testing without Firestore mocks. The trigger functions in `index.ts` are thin wrappers.

## Pure business logic modules

Decomposed from the monolithic `index.ts`:

- **datetime/:** Berlin timezone utilities (`berlinDateParts`, `isoWeekFromYmd`)
- **profile/:** Display name sanitization & leaderboard privacy logic
- **leaderboard/:** Ranking aggregation, period key calculations
- **authentication/:** Recaptcha response parsing & validation
- **motivation/:** Quote cache logic, Gemini fallback, name sanitization
- **push/subscription:** Subscription ID generation, payload validation
- **push/reminders:** Reminder scheduling (quiet hours, snooze, intervals)
- **admin/:** User privilege checks (Custom Claims validation), deletion validation, batch helpers

All modules include comprehensive Jest tests (no Firebase dependencies for pure logic).

## Admin Authorization

Admin access uses **Firebase Custom Claims** (`{ admin: true }`) — NOT Firestore fields. This ensures only server-side Admin SDK can grant admin privileges.

- **Cloud Functions:** `assertAdmin(request)` checks `request.auth.token.admin === true`
- **Frontend guard:** `adminGuard` reads `getIdTokenResult().claims.admin`
- **Frontend service:** `UserContextService.isAdmin` checks ID token claims via resource
- **Firestore rules:** Client writes to `role` field are blocked as defense-in-depth
- **Granting admin:** `node scripts/set-admin-claim.mjs <email-or-uid>` (requires Admin SDK credentials)
- **Token refresh:** After setting claims, user must re-login (or wait ~1h) for the token to update
