import {
  MAX_PROFILE_WORKOUTS,
  MAX_WORKOUTS,
  normalizeWorkout,
  type PublicProfileWorkout,
  type Workout,
} from '@pu-stats/models';

/**
 * Pure side of workouts on the server: which documents a profile lists,
 * and who can still receive a copy. Firestore lives in
 * `functions-workouts.ts` and `functions-public-profile.ts`.
 */

export interface RawWorkoutDoc {
  readonly id: string;
  readonly data: unknown;
}

/** What a visitor gets of a workout: enough to run or copy it. */
export function toPublicWorkout(workout: Workout): PublicProfileWorkout {
  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    exercises: workout.exercises.map((e) => ({ ...e })),
  };
}

/**
 * The workouts a profile lists: the valid ones the owner put there,
 * newest change first, capped. Invalid documents are dropped rather
 * than failing the page — the owner can write anything into their own.
 */
export function profileWorkouts(
  docs: ReadonlyArray<RawWorkoutDoc>
): PublicProfileWorkout[] {
  return docs
    .map((doc) => normalizeWorkout(doc.id, doc.data))
    .filter((w): w is Workout => w !== null && w.onProfile)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_PROFILE_WORKOUTS)
    .map(toPublicWorkout);
}

export interface ShareSplit {
  /** Recipients who still have room for one more workout. */
  readonly send: string[];
  /** Recipients already at `MAX_WORKOUTS`; the sender is told, not failed. */
  readonly full: string[];
}

/**
 * Who gets the copy. A friend at their limit is skipped rather than
 * making the whole share fail — the others still want it.
 */
export function splitByRoom(
  recipients: ReadonlyArray<string>,
  counts: ReadonlyMap<string, number>
): ShareSplit {
  const send: string[] = [];
  const full: string[] = [];
  for (const uid of recipients) {
    ((counts.get(uid) ?? 0) >= MAX_WORKOUTS ? full : send).push(uid);
  }
  return { send, full };
}
