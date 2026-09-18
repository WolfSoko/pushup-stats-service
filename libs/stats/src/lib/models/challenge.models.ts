import { isValidFriendUid } from './friendship.models';

/**
 * Friend challenges: a rep target for one exercise that a group of
 * confirmed friends chases together over a few days.
 *
 * One document per challenge at `challenges/{id}`. Written only by the
 * `functions-challenges` callables — who is in it decides whose numbers
 * the others get to see, exactly like a friendship does.
 */

export interface Challenge {
  createdBy: string;
  /**
   * Everyone whose progress counts, the creator first. Only they see
   * each other's numbers — being in here is the consent for that.
   */
  participants: string[];
  /** Asked, not yet answered. They see the challenge, not the numbers. */
  invited: string[];
  exerciseId: string;
  target: number;
  /** First and last day that count, inclusive, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  createdAt: string;
}

/** The creator plus at most this many friends. */
export const MAX_CHALLENGE_PARTICIPANTS = 20;

export const CHALLENGE_DURATIONS_DAYS = [3, 7, 14, 30] as const;
export type ChallengeDurationDays = (typeof CHALLENGE_DURATIONS_DAYS)[number];

export const MIN_CHALLENGE_TARGET = 10;
export const MAX_CHALLENGE_TARGET = 100_000;

/** How many challenges one user may have running at once. */
export const MAX_ACTIVE_CHALLENGES = 5;

export function isChallengeDuration(
  value: unknown
): value is ChallengeDurationDays {
  return (CHALLENGE_DURATIONS_DAYS as ReadonlyArray<unknown>).includes(value);
}

export type ChallengeRejection =
  | 'no-friends' // nobody invited
  | 'too-many' // over MAX_CHALLENGE_PARTICIPANTS
  | 'not-friends' // an invited uid is not a confirmed friend
  | 'exercise' // unknown or not a counted exercise
  | 'target' // outside [MIN, MAX] or not an integer
  | 'duration' // not one of CHALLENGE_DURATIONS_DAYS
  | 'limit'; // creator already runs MAX_ACTIVE_CHALLENGES

/**
 * Whether a challenge may be created from these inputs. Shared between the
 * dialog (so the form can refuse early) and the callable (which is the one
 * that counts). `null` means it may.
 */
export function challengeRejection(args: {
  readonly friendUids: unknown;
  readonly acceptedFriendUids: ReadonlyArray<string>;
  readonly target: unknown;
  readonly days: unknown;
  readonly exerciseValid: boolean;
  readonly activeCount: number;
}): ChallengeRejection | null {
  const uids = args.friendUids;
  if (!Array.isArray(uids) || uids.length === 0) return 'no-friends';
  if (uids.length > MAX_CHALLENGE_PARTICIPANTS - 1) return 'too-many';
  const friends = new Set(args.acceptedFriendUids);
  if (!uids.every((uid) => isValidFriendUid(uid) && friends.has(uid))) {
    return 'not-friends';
  }
  if (!args.exerciseValid) return 'exercise';
  if (
    typeof args.target !== 'number' ||
    !Number.isInteger(args.target) ||
    args.target < MIN_CHALLENGE_TARGET ||
    args.target > MAX_CHALLENGE_TARGET
  ) {
    return 'target';
  }
  if (!isChallengeDuration(args.days)) return 'duration';
  if (args.activeCount >= MAX_ACTIVE_CHALLENGES) return 'limit';
  return null;
}

/** `days` calendar days starting at `fromIso`, last day inclusive. */
export function challengeEndDate(fromIso: string, days: number): string {
  return addDays(fromIso, days - 1);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export type ChallengeRespondRejection = 'not-found' | 'not-invited' | 'ended';

/**
 * Whether `uid` may answer this invitation: only someone still on the
 * invited list, and only while the challenge is running — accepting a
 * finished challenge would add a participant to a result.
 */
export function challengeRespondRejection(
  challenge: Pick<Challenge, 'invited' | 'to'> | undefined,
  uid: string,
  todayIso: string
): ChallengeRespondRejection | null {
  if (!challenge) return 'not-found';
  if (!challenge.invited.includes(uid)) return 'not-invited';
  if (challengeStatus(challenge, todayIso) === 'ended') return 'ended';
  return null;
}

export type ChallengeStatus = 'active' | 'ended';

export function challengeStatus(
  challenge: Pick<Challenge, 'to'>,
  todayIso: string
): ChallengeStatus {
  return todayIso > challenge.to ? 'ended' : 'active';
}

/** Days still to go, today included; 0 once the challenge is over. */
export function challengeDaysLeft(
  challenge: Pick<Challenge, 'to'>,
  todayIso: string
): number {
  if (todayIso > challenge.to) return 0;
  const to = Date.parse(`${challenge.to}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((to - today) / 86_400_000) + 1;
}

/** Progress as a whole percentage, capped at 100. */
export function challengePercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((Math.max(0, value) / target) * 100));
}

/**
 * How long an ended challenge stays on the friends screen so the result
 * can be seen — after that it is history nobody asked for.
 */
export const CHALLENGE_RESULT_VISIBLE_DAYS = 7;
