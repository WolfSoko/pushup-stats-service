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
- **motivation/:** Quote cache logic, Gemini fallback, name sanitization
- **push/subscription:** Subscription ID generation, payload validation
- **push/reminders:** Reminder scheduling (quiet hours, snooze, intervals)
- **admin/:** User privilege checks (Custom Claims validation), deletion validation, batch helpers
- **entry-trash/:** Archive record for deleted entries (retention window, owner extraction)

All modules include comprehensive Jest tests (no Firebase dependencies for pure logic).

## Deleted-entry trash bin

`archiveDeletedExerciseEntry` (`onDocumentDeleted` on `exerciseEntries/{entryId}`) copies every deleted entry into `deletedExerciseEntries`, keyed by the same doc id. Purpose is **traceability only** — no user-facing recovery flow exists, and `firestore.rules` denies clients any access to the collection.

Sitting on the delete trigger rather than in the client's delete call means every path is covered: entries page, training-plan reset, the admin entry-delete callable, Admin-SDK cleanup. Reusing the entry id keeps the trigger's at-least-once delivery idempotent.

**Retention is a Firestore TTL policy on `expiresAt`, not a scheduled function.** TTL policies are project state — they are NOT part of `firestore.rules` / `firestore.indexes.json` and `firebase deploy` does not create them. A new environment has to run:

```bash
./infra/setup-firestore-ttl.sh                       # prod
./infra/setup-firestore-ttl.sh --project <staging>   # any other environment
```

Two consequences worth remembering:

- `expiresAt` must be a real Firestore `Timestamp`. TTL ignores ISO strings, and the documents would never expire.
- Expiry is approximate: Firestore deletes expired documents typically within 24 hours of `expiresAt`, and they stay readable until then. Irrelevant at a 365-day window, but do not build exact-cutoff assumptions on it.

## Admin Authorization

Admin access uses **Firebase Custom Claims** (`{ admin: true }`) — NOT Firestore fields. This ensures only server-side Admin SDK can grant admin privileges.

- **Cloud Functions:** `assertAdmin(request)` checks `request.auth.token.admin === true`
- **Frontend guard:** `adminGuard` reads `getIdTokenResult().claims.admin`
- **Frontend service:** `UserContextService.isAdmin` checks ID token claims via resource
- **Firestore rules:** Client writes to `role` field are blocked as defense-in-depth
- **Granting admin:** `node scripts/set-admin-claim.mjs <email-or-uid>` (requires Admin SDK credentials)
- **Token refresh:** After setting claims, user must re-login (or wait ~1h) for the token to update
