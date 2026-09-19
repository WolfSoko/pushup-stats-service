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

/** Whether a list of `count` workouts may take one more. */
export function hasRoom(count: number): boolean {
  return count < MAX_WORKOUTS;
}
