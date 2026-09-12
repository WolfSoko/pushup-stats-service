import {
  addDays,
  CHALLENGE_RESULT_VISIBLE_DAYS,
  challengeStatus,
  type Challenge,
} from '@pu-stats/models';

/**
 * Pure side of friend challenges: which of a user's challenges are worth
 * showing, and how a set of per-participant sums turns into a board.
 * Firestore lives in `functions-challenges.ts`.
 */

export interface ChallengeDoc extends Challenge {
  readonly id: string;
}

export interface ChallengeParticipantEntry {
  readonly uid: string;
  readonly displayName: string | null;
  readonly value: number;
  readonly isViewer: boolean;
}

export interface ChallengeView {
  readonly id: string;
  readonly createdBy: string;
  readonly exerciseId: string;
  readonly target: number;
  readonly from: string;
  readonly to: string;
  readonly status: 'active' | 'ended';
  /** Highest first; the viewer is always in it. */
  readonly entries: ReadonlyArray<ChallengeParticipantEntry>;
}

/**
 * Active challenges, and ended ones for a week so the result can be seen.
 * Anything older is over, and a screen of old challenges is not a
 * feature. Newest first, so the one just created is on top.
 */
export function visibleChallenges(
  docs: ReadonlyArray<ChallengeDoc>,
  todayIso: string
): ChallengeDoc[] {
  const cutoff = addDays(todayIso, -CHALLENGE_RESULT_VISIBLE_DAYS);
  return docs
    .filter((doc) => doc.to >= cutoff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function activeChallengeCount(
  docs: ReadonlyArray<ChallengeDoc>,
  todayIso: string
): number {
  return docs.filter((doc) => challengeStatus(doc, todayIso) === 'active')
    .length;
}

/**
 * `timestamp >= from` and `timestamp < the day after to`, as ISO-string
 * bounds: entries store ISO timestamps, and a date prefix sorts before
 * any time on that date. Entries stored in UTC (`…Z`) that fall in the
 * last two Berlin hours of the boundary day land on the neighbouring
 * date — accepted, as the aggregates do not keep per-entry timestamps
 * either.
 */
export function challengeEntryBounds(
  challenge: Pick<Challenge, 'from' | 'to'>
): {
  readonly fromInclusive: string;
  readonly toExclusive: string;
} {
  return {
    fromInclusive: challenge.from,
    toExclusive: addDays(challenge.to, 1),
  };
}

/**
 * The exercise name the creator's app showed, for the invitation push.
 * The server has no localized catalog, so the client's label is taken —
 * stripped to plain text and cut short, since it ends up on other
 * people's lock screens. Falls back to the id.
 */
export function sanitizeExerciseName(raw: unknown, exerciseId: string): string {
  const clean =
    typeof raw === 'string'
      ? raw
          .replace(/[^\p{L}\p{N} .,()'’-]/gu, '')
          .trim()
          .slice(0, 40)
      : '';
  return clean || exerciseId;
}

export function buildChallengeView(
  doc: ChallengeDoc,
  sums: ReadonlyMap<string, number>,
  names: ReadonlyMap<string, string>,
  viewerUid: string,
  todayIso: string
): ChallengeView {
  const entries = doc.participants
    .map((uid) => ({
      uid,
      displayName: names.get(uid) ?? null,
      value: Math.round(sums.get(uid) ?? 0),
      isViewer: uid === viewerUid,
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        (a.displayName ?? '').localeCompare(b.displayName ?? '')
    );
  return {
    id: doc.id,
    createdBy: doc.createdBy,
    exerciseId: doc.exerciseId,
    target: doc.target,
    from: doc.from,
    to: doc.to,
    status: challengeStatus(doc, todayIso),
    entries,
  };
}
