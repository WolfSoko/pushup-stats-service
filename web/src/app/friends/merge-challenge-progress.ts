import type { ChallengeView } from './challenges-api.service';

/**
 * Carries sums (and the cheer state read with them) an earlier full load
 * already read into a count-only answer.
 *
 * A count-only reload asks the server to skip the per-participant sums, so
 * every entry comes back at 0. Those calls come from surfaces that only
 * count (the nav badge, the dashboard card) and share the store with the
 * ones that show the numbers — without this, the badge's answer blanks the
 * progress bars on the friends page and everybody reads 0 / target.
 */
export function withKnownProgress(
  fresh: ReadonlyArray<ChallengeView>,
  known: ReadonlyArray<ChallengeView>
): ReadonlyArray<ChallengeView> {
  if (known.length === 0) return fresh;
  const previous = new Map(known.map((challenge) => [challenge.id, challenge]));
  return fresh.map((challenge) => {
    const before = previous.get(challenge.id);
    if (!before || before.entries.length === 0) return challenge;
    const known = new Map(before.entries.map((e) => [e.uid, e]));
    return {
      ...challenge,
      entries: challenge.entries
        .map((entry) => {
          const earlier = known.get(entry.uid);
          if (!earlier) return entry;
          // The cheer state is read alongside the sums, so it goes stale
          // with them and is carried over the same way.
          return {
            ...entry,
            value: earlier.value,
            canCheer: earlier.canCheer,
            cheered: earlier.cheered,
          };
        })
        .sort(byValueThenName),
      progressUnavailable: before.progressUnavailable,
    };
  });
}

/** The order the server sends a scored board in: ahead first. */
function byValueThenName(
  a: { value: number; displayName: string | null },
  b: { value: number; displayName: string | null }
): number {
  return (
    b.value - a.value ||
    (a.displayName ?? '').localeCompare(b.displayName ?? '')
  );
}
