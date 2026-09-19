import { isValidFriendUid } from './friendship.models';
import type { Workout, WorkoutSource } from './workout.models';

/**
 * Sharing a workout with friends: the copy a recipient gets, and who may
 * send to whom. Shared between the share dialog and the `shareWorkout`
 * callable, which is the one that counts.
 */

export const MAX_WORKOUT_SHARE_RECIPIENTS = 20;

/** The copy a recipient gets; never on their profile until they say so. */
export function copyWorkout(
  source: Workout,
  args: {
    readonly ownerId: string;
    readonly sharedBy: WorkoutSource;
    readonly now: string;
  }
): Omit<Workout, 'id'> {
  return {
    ownerId: args.ownerId,
    title: source.title,
    description: source.description,
    exercises: source.exercises.map((e) => ({ ...e })),
    onProfile: false,
    sharedBy: args.sharedBy,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

export type WorkoutShareRejection =
  | 'not-found' // no such workout, or not the caller's
  | 'no-friends'
  | 'too-many'
  | 'not-friends' // a recipient is not a confirmed friend
  | 'invalid'; // the stored workout no longer validates

/**
 * Whether `uid` may send this workout to these friends. Shared between
 * the dialog and the `shareWorkout` callable, which is the one that
 * counts.
 */
export function workoutShareRejection(args: {
  readonly uid: string;
  readonly workout: Workout | null;
  readonly friendUids: unknown;
  readonly acceptedFriendUids: ReadonlyArray<string>;
}): WorkoutShareRejection | null {
  if (!args.workout || args.workout.ownerId !== args.uid) return 'not-found';
  const uids = args.friendUids;
  if (!Array.isArray(uids) || uids.length === 0) return 'no-friends';
  if (uids.length > MAX_WORKOUT_SHARE_RECIPIENTS) return 'too-many';
  const friends = new Set(args.acceptedFriendUids);
  if (!uids.every((uid) => isValidFriendUid(uid) && friends.has(uid))) {
    return 'not-friends';
  }
  return null;
}
