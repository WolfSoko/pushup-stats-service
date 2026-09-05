import type { EarnedAchievement } from '@pu-stats/models';

export const STORAGE_KEY = 'pus_achievements_celebrated';

/**
 * Ids worth celebrating right now: earned, not celebrated before, newest
 * first.
 *
 * Awarding happens server-side and asynchronously, so the client learns
 * about a badge whenever the document happens to sync — possibly on a
 * later visit, possibly twice. Dedupe is therefore not a nicety: without
 * it the dialog would reopen on every reload.
 */
export function pendingCelebrations(
  earned: ReadonlyArray<EarnedAchievement>,
  celebrated: ReadonlySet<string>
): ReadonlyArray<string> {
  return [...earned]
    .filter((entry) => entry?.id && !celebrated.has(entry.id))
    .sort((a, b) => String(b.awardedAt).localeCompare(String(a.awardedAt)))
    .map((entry) => entry.id);
}

/**
 * Reading `localStorage` can throw outright — sandboxed origins, Safari
 * private mode, storage disabled — so every access is guarded and a
 * failure degrades to "nothing celebrated yet" rather than breaking
 * startup.
 */
export function readCelebrated(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markCelebrated(ids: ReadonlyArray<string>): void {
  if (ids.length === 0) return;
  try {
    const merged = new Set([...readCelebrated(), ...ids]);
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify([...merged].sort())
    );
  } catch {
    // Best effort: a viewer with storage disabled sees the dialog again,
    // which is better than a hard failure on a celebration.
  }
}
