# Gotchas: Firestore (client SDK)

> Most of this file is about the **client** SDK (`@angular/fire/firestore`).
> The Admin-SDK section at the bottom is the exception — and it contradicts
> the first section's claim, so read both before writing a nested patch.

## Never use dotted field paths with `set()` (Admin SDK)

`update()` expands `'a.b'` into a field **path**. `set()` does **not** — it
writes a literal top-level field whose name contains a dot. The SDK signals
this by backtick-quoting the field in the update mask:

```ts
batch.set(ref, { 'androidTest.status': 'candidate' }, { merge: true });
// updateMask: ["`androidTest.status`"]   ← literal field name
batch.set(ref, { androidTest: { status: 'candidate' } }, { merge: true });
// updateMask: ["androidTest.status"]     ← real nested path
```

Nothing throws. Writes "succeed", and every later
`snap.data()?.androidTest?.status` reads `undefined`. This silently killed the
whole Android-test flow (candidates never appeared, opt-in always threw
`failed-precondition`) until the serialization was measured directly. Reach
for `update()` when you want dot paths, or pass a nested object to `set()`.

## `set(..., { merge: true })` and nested maps (Admin SDK, measured)

Measured against the `firebase-admin` version pinned in this repo: a nested
object under `{ merge: true }` produces a **leaf-level** field mask, so
siblings survive. Writing `{ androidTest: { status, optedInAt } }` yields the
mask `["androidTest.optedInAt", "androidTest.status"]` — an earlier
`androidTest.confirmedAt` is untouched.

This contradicts the client-SDK claim in the next section. Both cannot be
right about the same underlying wire format. The next section's _symptom_
(lost `ui.*` siblings) is real and predates this note, but its stated _cause_
was never re-verified — a likelier culprit is `UserConfigApiService.setConfig`,
which calls `setDoc` **without** `merge` and therefore does replace the
document. Before relying on either claim for a new write path, measure the
update mask for your actual SDK and call shape rather than trusting this file.

## `setDoc(..., { merge: true })` replaces nested maps wholesale

`{ merge: true }` only merges at the **top level**. If the patch contains a nested map (e.g. `ui: { snapQuality: 'high' }`), the entire `ui` field on the document is replaced with that object — every sibling key (`dayChartMode`, `quickAdds`, `showSourceColumn`, `hideFromLeaderboard`, …) is silently lost.

This is the documented Firestore behaviour, not a bug, and it bites every nested write path that doesn't first read the current state.

**Affected today:** `UserConfigApiService.updateConfig` is called from settings pages with a partial `ui` object. Any caller that sets only some `ui.*` fields drops the rest.

**Fixes (pick one per call site):**

1. **Read-modify-write the nested map** in the caller before invoking `updateConfig`:
   ```ts
   const current = this.userConfigStore.config()?.ui ?? {};
   await this.userConfigStore.save({
     ui: { ...current, snapQuality: this.snapQualityDraft() },
   });
   ```
2. **Use dot-notation field paths** with `updateDoc` (Firestore merges these without replacing the parent map):
   ```ts
   await updateDoc(ref, { 'ui.snapQuality': value });
   ```
3. **Centralise the read-modify-write** inside `UserConfigApiService.updateConfig` itself by `getDoc`-ing first and deep-merging the patch. Costs one extra read per write but removes the foot-gun for every caller.

When in doubt, write a test that saves a partial `ui` patch and asserts the unrelated `ui.*` keys survive — none exist today, which is why the regression has slipped through repeatedly.

## `getDoc` after `setDoc` race

`setDoc` resolves once the local mutation is queued, not once the server has acknowledged it. A `getDoc` immediately afterwards may return the cached value from before the write. If you need to assert the persisted shape (mostly in tests), force a server fetch with `getDoc(ref, { source: 'server' })`.

## Real-time reads: `docData` + `rxResource`, never `firstValueFrom` inside `resource()`

`resource({ loader })` is for one-shot Promise loaders. Wrapping a Firestore observable as `firstValueFrom(this.api.getConfig(uid))` inside a `resource` loader collapses a long-lived stream into a single emission — the store will never see subsequent doc updates (settings edits from another tab, Cloud Function rewrites of `userStats/*`, etc.).

For real-time data:

1. Return `docData(ref)` / `collectionData(query)` from the API service, not `from(getDoc(ref))`. The signature stays `Observable<T>` but the source now emits on every change.
2. Consume it via `rxResource({ stream })`, not `resource({ loader })`:

   ```ts
   import { rxResource } from '@angular/core/rxjs-interop';

   configResource: rxResource({
     params: () => ({ userId: store._user.userIdSafe() }),
     stream: ({ params }) => (params.userId ? store._api.getConfig(params.userId) : of(null)),
   });
   ```

3. Existing `firstValueFrom(api.getConfig(uid))` callers (one-shot snapshots in app-bootstrap hooks, write-then-read flows) keep working — `firstValueFrom` resolves with the first emission and unsubscribes.

When migrating, audit consumers that subscribe directly without unsubscription (e.g. ad-hoc `.subscribe(...)` calls) — those previously completed after one emission and now leak. Wrap in `take(1)` / `firstValueFrom` or move them under a `DestroyRef`-aware helper.

## Naive vs TZ-aware ISO timestamps

`PushupRecord.timestamp` is **not** uniformly UTC. `createPushup()` writes `new Date().toISOString()` (`...Z`), but legacy / quick-add code paths still produce naive `YYYY-MM-DDTHH:mm[:ss]` strings — and the backend (`berlinParts`, period-key bucketing, `USERSTATS_VERSION` v3) explicitly treats those as Berlin local time.

`new Date('2026-04-22T08:00:00')` parses in the **device's** timezone, so on any client outside `Europe/Berlin` the resulting Date hits a different Berlin day than the backend computed for the same string. Anything that buckets, filters, or compares timestamps must replicate the backend convention:

```ts
const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;
function entryBerlinDate(timestamp: string): string {
  return HAS_TIMEZONE.test(timestamp) ? toBerlinIsoDate(new Date(timestamp)) : timestamp.slice(0, 10); // already a Berlin-local date prefix
}
```

`entry.timestamp.slice(0, 10)` alone is wrong for TZ-aware timestamps near midnight (UTC date != Berlin date during summer hours); `toBerlinIsoDate(new Date(...))` alone is wrong for naive timestamps off-Berlin. Handle both.
