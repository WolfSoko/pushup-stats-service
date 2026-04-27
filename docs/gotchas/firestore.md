# Gotchas: Firestore (client SDK)

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
