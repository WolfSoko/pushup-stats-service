# Migration runbook: Pushup unification (`pushups` → `exerciseEntries`)

Staged, **reversible** copy of the legacy `pushups` collection into the
unified `exerciseEntries` collection with `exerciseId: 'pushup'`. Tracks
issue #432. Phase-7 follow-up of the [multi-exercise roadmap](../../plans/multi-exercise-roadmap.md).

## Scope

- **Copy only.** Each `pushups/{id}` is written to
  `exerciseEntries/pushup__{id}` (deterministic `pushup__`-prefixed id)
  carrying `exerciseId:'pushup'` and a provenance marker
  `migratedFrom:'pushups'`.
- **No write-path flip.** New pushups still land in `pushups`, and the web
  app still reads pushups from the legacy `pushups` collection + its
  `userStats/{userId}` doc. This PR adds the unification foundation and the
  migration code (in `web/**` and `libs/**`), but does not change the pushup
  runtime read/write path — that flip is Phase 7.
- **No legacy deletion.** The source collection is left intact.
- **Idempotent.** Re-running re-uses the same prefixed id `pushup__{id}`
  under `set()`, so a second run writes nothing new (everything classifies
  as skip-existing).
- **Dest id = `pushup__{source-id}`, by design.** The `pushup__` prefix
  makes the migrated id deterministic (enabling idempotency and exact
  rollback) while guaranteeing it can never collide with a
  natively-created `exerciseEntries` doc (Firestore auto-ids never start
  with `pushup__`, and no client write path produces `exerciseId:'pushup'`
  entries).
- **The legacy pushup variant (`type`) is dropped.** The unified
  `ExerciseEntry` schema has no pushup-variant field, so `type` (e.g.
  `diamond`, `wide`) is intentionally NOT copied. Variant history remains
  recoverable from the untouched `pushups` collection until cutover.

Invalid sources are skipped (not copied): missing `userId`/`timestamp`,
non-numeric / non-finite / `<= 0` `reps`. `sets` are sanitised to finite
positive integers and omitted when empty.

## Preconditions

- Caller has the `admin` custom claim (both callables go through
  `validateAdminAccess`).
- The Cloud Functions bundle is deployed with:
  - `PUSHUP_DEFINITION` resolvable via `findExerciseDefinition` (it is
    deliberately folded into the by-id lookup only, NOT the iterable
    `EXERCISE_CATALOG`),
  - the two callables `migratePushupsToExerciseEntries` and
    `rollbackPushupUnification`,
  - the two trigger guards (`updateExerciseStatsOnEntryWrite` and
    `refreshExerciseLeaderboardsOnEntryWrite` early-return for
    `exerciseId === 'pushup'`).
- `firestore.rules` is intentionally **UNCHANGED**: the Admin SDK bypasses
  rules entirely, and `pushup` deliberately stays OUT of the rules'
  `isRepsExerciseId` allowlist so client writes of `exerciseId:'pushup'`
  to `exerciseEntries` remain blocked. Only the admin migration may create
  those docs.

## Dry-run (default, fail-safe)

Both callables default to `dryRun: true`. Run the migration dry-run first:

```js
// authenticated as an admin (Firebase callable)
await firebase.functions('europe-west3').httpsCallable('migratePushupsToExerciseEntries')({ dryRun: true });
// → { dryRun: true, wouldCopy, wouldSkipExisting, wouldSkipInvalid }
```

Sanity-check the counts: `wouldCopy + wouldSkipExisting + wouldSkipInvalid`
should equal the number of `pushups` docs. On a first run `wouldCopy`
should be the count of valid pushups and `wouldSkipExisting` should be 0.

## Run (off-peak)

Run during a low-traffic window — the job reads the whole `pushups`
collection and writes in ≤500-doc batches.

```js
await firebase.functions('europe-west3').httpsCallable('migratePushupsToExerciseEntries')({ dryRun: false });
// → { copied, skippedExisting, skippedInvalid }
```

## Verify

- **Spot-check dest docs.** Pick a handful of source `pushups/{id}` and
  read `exerciseEntries/pushup__{id}`; confirm each carries:
  - `exerciseId: 'pushup'`,
  - `migratedFrom: 'pushups'`,
  - matching `reps`, `timestamp`, `source`, and `sets` (sanitised) from
    the source,
  - no `type` / `variantId` field.
- **Count parity.** `copied` from the run + any prior `skippedExisting`
  should equal the number of valid pushups (total pushups minus
  `skippedInvalid`).
- **No aggregate / leaderboard pollution.** Confirm the trigger guards
  held: there is **no** new `userStats/{userId}/perExercise/pushup` doc and
  **no** pushup row in the exercise leaderboards snapshot, even though
  ~thousands of `exerciseEntries` writes just fired.
- **Dashboard unaffected.** The Pushup dashboard (reading legacy `pushups`
  - `userStats/{userId}`) shows identical totals before and after.

## Idempotency

Re-run the dry-run after a committed run:

```js
await firebase.functions('europe-west3').httpsCallable('migratePushupsToExerciseEntries')({ dryRun: true });
// → wouldCopy: 0, wouldSkipExisting: <all valid>, wouldSkipInvalid: <same as before>
```

`wouldCopy: 0` proves the copy is idempotent: a re-run writes nothing new.

## Rollback

Deletes only `exerciseEntries` docs carrying `migratedFrom:'pushups'`
(the planner double-checks the marker, so a natively-created entry can
never be deleted). Dry-run first:

```js
await firebase.functions('europe-west3').httpsCallable('rollbackPushupUnification')({ dryRun: true });
// → { dryRun: true, wouldDelete }

await firebase.functions('europe-west3').httpsCallable('rollbackPushupUnification')({ dryRun: false });
// → { deleted }
```

Because the legacy `pushups` collection is never touched, rollback is
loss-free: it removes the copies and leaves the source-of-truth intact.

## Deferred to Phase-7 cutover

These are explicitly **out of scope** for this staged migration and land
in Phase 7 of the [multi-exercise roadmap](../../plans/multi-exercise-roadmap.md):

- Flipping the write path so new pushups land in `exerciseEntries`.
- Deleting the legacy `pushups` collection (after a Sentry/observation
  cut-off).
- Removing the trigger guards (`shouldAggregateExerciseEntry`) so
  `exerciseId:'pushup'` starts aggregating into `perExercise/pushup` and
  the pushup leaderboard.
- Removing the `kind:'pushup'` union special-casing in
  `libs/stats/.../unified-entry.models.ts`.
