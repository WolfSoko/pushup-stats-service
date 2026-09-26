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
- **push/reminders:** Reminder scheduling (quiet hours, intervals)
- **push/reminder-action:** Single-use action tokens for the notification buttons (`reminderAction` callable — see [`gotchas/push-and-service-workers.md`](gotchas/push-and-service-workers.md))
- **admin/:** User privilege checks (Custom Claims validation), deletion validation, batch helpers
- **entry-trash/:** Archive record for deleted entries (retention window, owner extraction)
- **training/:** the cross-exercise training aggregate — entry → line mapping (`lines.ts`), the delta-or-rebuild decision (`aggregate.ts`), reads with the in-memory fallback (`stats-read.ts`); the trigger is `functions-training-stats.ts`, design in [`architecture.md`](architecture.md#cross-exercise-training-aggregate)
- **xp/:** XP ledger lines with frozen rates (`ledger.ts`), the `userXp` aggregate (`aggregate.ts`), level/variety badges (`badges.ts`), backfill planning (`backfill-plan.ts`); I/O in `award.ts`, `config-read.ts` (60 s cache), `leaderboard.ts`, `rebuild.ts`

All modules include comprehensive Jest tests (no Firebase dependencies for pure logic).

## Deleted-entry trash bin

`archiveDeletedExerciseEntry` (`onDocumentDeleted` on `exerciseEntries/{entryId}`) copies every deleted entry into `deletedExerciseEntries`, keyed by the same doc id. Purpose is **traceability only** — no user-facing recovery flow exists, and `firestore.rules` denies clients any access to the collection.

Sitting on the delete trigger rather than in the client's delete call means every path is covered: entries page, training-plan reset, the admin entry-delete callable, Admin-SDK cleanup. Reusing the entry id keeps the trigger's at-least-once delivery idempotent.

**Retention is a Firestore TTL policy on `expiresAt`, not a scheduled function.** The policy is declared in `firestore.indexes.json` as a `fieldOverrides` entry with `"ttl": true`, and `firebase deploy --only firestore` applies it. Declaring it there is not optional bookkeeping: the deploy reconciles field configuration against that file and **removes** any policy it does not find — a hand-enabled TTL survives until the next merge and no further. See [`docs/gotchas/cloud-functions.md`](gotchas/cloud-functions.md).

The same applies to `cheers` (a friend cheer matters today; expires two days out), `challenges` (a week past the end date, when the result stops being shown) and `friendInvites` (30 days, refreshed whenever the owner asks for their link again). Any collection that grows per user action and has no owner to delete it belongs in that list — and a guard test in `firestore-indexes.spec.ts` fails if one is missing from it.

`friendInvites` is the one where expiry is a security property rather than housekeeping: the token is what lets a link open a friend request in its owner's name. Because the deletion below is only approximate, `claimFriendInvite` compares `expiresAtMs` itself and refuses a stale token the sweeper has not reached yet — the TTL policy is there to stop the collection growing, not to enforce the deadline.

Two consequences worth remembering:

- `expiresAt` must be a real Firestore `Timestamp`. TTL ignores ISO strings, and the documents would never expire.
- Expiry is approximate: Firestore deletes expired documents typically within 24 hours of `expiresAt`, and they stay readable until then. Irrelevant at a 365-day window, but do not build exact-cutoff assumptions on it.

## XP / Punkte-System

`functions-xp.ts` holds the three triggers — `bookXpOnEntryWrite` (entry → ledger line in `userXp/{uid}/xpLedger/{entryId}`, rate frozen on first booking, built transactionally from the current entry doc so unordered deliveries cannot regress it), `aggregateXpOnLedgerWrite` (ledger → `userXp/{uid}` aggregate, deduped by event id via `recentEventIds`, + level/variety badges + inbox notification) and `refreshXpLeaderboardOnLedgerWrite` (ledger → windowed periods of `leaderboards/xp`, `retry: false` like the exercise refresh). The scheduled `rebuildExerciseLeaderboards` also rebuilds the XP board's all-time ranking. `functions-xp-backfill.ts` exports the admin migration `backfillXp` (`{ dryRun }`, 200 users per run, reports `remaining`). Ledger lines written by the backfill carry `source: 'backfill'`, and both ledger triggers skip their creation (`isBackfillCreation`); the backfill rebuilds each aggregate from a fresh ledger read inside a transaction (`xp/rebuild.ts`). All ledger/aggregate triggers honour the account-deletion tombstone. Design and client side: [`architecture.md`](architecture.md#xp--punkte-system).

## Account deletion (data purge)

Deleting an account removes **every** document about the user — the privacy policy (`@@datenschutz.deletion.body`) promises exactly that. The purge runs server-side in `deleteAccountWithData()` — purge first, Auth user last, so a failed purge leaves a working account to retry with. Self-service deletion goes through the `deleteOwnAccount` callable, which re-applies Firebase's recent-login rule on the token's `auth_time` (5 min); `adminDeleteUser` and `adminBulkDeleteInactiveAnonymous` call the same helper. **Not an Auth `onDelete` trigger:** that exists only in 1st gen, and 1st gen cannot run the `nodejs24` runtime this codebase deploys with (the deploy fails with `Runtime "nodejs24" is not supported on GCF Gen1`). Accounts deleted in the Firebase console are therefore not purged immediately — `cleanupOrphanedUserData` picks them up.

- **Inventory lives in `account-deletion/plan.ts`.** `UID_KEYED_COLLECTIONS` (doc id = uid, deleted recursively with their subcollections), `OWNED_QUERIES` (deleted by field match: entries, trash, workouts, friendships, invites, cheers), `UID_PREFIXED_COLLECTIONS` (`{uid}__{suffix}` ids such as `motivationQuotes/{uid}__{lang}`, deleted by id range), `ANONYMIZED_QUERIES` (feedback reports keep their text, lose `userId`/`email`/`name`). Challenges drop the user from `participants`/`invited` and go away when nobody is left. The profile-photo folder in Storage is deleted too. **A new per-user collection must be added to `plan.ts`** — otherwise it outlives every deleted account.
- **Tombstone `deletedAccounts/{uid}`.** Written before the first delete. The `exerciseEntries` triggers (trash archive, `userStats`, `adminUserActivity`, leaderboard refresh, XP booking) and the `xpLedger` triggers call `isPurgedEntryDeletion()` on a delete event and stand down — otherwise they would re-create the archive and zeroed aggregates the purge just removed, and rebuild the leaderboard once per deleted entry. Triggers honour a tombstone for one hour (`expiresAt`), so an account whose deletion failed halfway gets its normal trigger behaviour back; the TTL policy then removes it. Guests are exempt from the recent-login rule — an anonymous account cannot sign in again. `adminBulkDeleteInactiveAnonymous` deletes at most 25 accounts per run and reports `remaining`.
- **Idempotent.** Every step deletes what still matches, so `failurePolicy` retries simply finish the job.
- **Legacy junk:** `cleanupOrphanedUserData` (admin migrations page, `{ dryRun }` contract) finds uids that still own data but have no Auth account — leftovers from the time the settings only anonymized `userConfigs` — and purges up to 25 per run.
- Not covered: inbox entries in _other_ users' inboxes naming the deleted user as actor; they expire through the inbox TTL.

## Admin Authorization

Admin access uses **Firebase Custom Claims** (`{ admin: true }`) — NOT Firestore fields. This ensures only server-side Admin SDK can grant admin privileges.

- **Cloud Functions:** `assertAdmin(request)` checks `request.auth.token.admin === true`
- **Frontend guard:** `adminGuard` reads `getIdTokenResult().claims.admin`
- **Frontend service:** `UserContextService.isAdmin` checks ID token claims via resource
- **Firestore rules:** Client writes to `role` field are blocked as defense-in-depth
- **Granting admin:** `node scripts/set-admin-claim.mjs <email-or-uid>` (requires Admin SDK credentials)
- **Token refresh:** After setting claims, user must re-login (or wait ~1h) for the token to update
