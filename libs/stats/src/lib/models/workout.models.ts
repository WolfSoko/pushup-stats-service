import { findExerciseDefinition } from './exercise.catalog';
import type { ExerciseDefinition, MeasurementType } from './exercise.models';
import { isValidFriendUid } from './friendship.models';
import type {
  TrainingPlanDay,
  TrainingPlanExercise,
} from './training-plan.models';

/**
 * A workout is a training session the user composed themselves: a named
 * list of catalog exercises with targets, to be walked by the guided
 * session like a plan day is. One document per workout at
 * `workouts/{id}`, owned by `ownerId`.
 *
 * Sharing has two paths. `onProfile` lists the workout on the owner's
 * profile, where the `workouts` section's audience decides who may see it
 * and take a copy. `sharedBy` marks a copy that arrived from someone
 * else — a friend sent it, or the owner took it off a profile — and
 * names the source so the list can say where it came from.
 */
export interface WorkoutSource {
  uid: string;
  workoutId: string;
  displayName: string | null;
}

export interface Workout {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  exercises: ReadonlyArray<TrainingPlanExercise>;
  onProfile: boolean;
  sharedBy?: WorkoutSource;
  createdAt: string;
  updatedAt: string;
}

/** What the editor produces and the API persists. */
export type WorkoutInput = Pick<
  Workout,
  'title' | 'description' | 'exercises' | 'onProfile'
>;

export const WORKOUT_TITLE_MAX = 60;
export const WORKOUT_DESCRIPTION_MAX = 300;
export const WORKOUT_MAX_EXERCISES = 20;
export const WORKOUT_MAX_SETS = 20;
/** Workouts one user may keep, received copies included. */
export const MAX_WORKOUTS = 50;
/** Workouts a profile lists at most. */
export const MAX_PROFILE_WORKOUTS = 10;
export const MAX_WORKOUT_SHARE_RECIPIENTS = 20;

/**
 * Widest target per measurement, in the exercise's unit — the same
 * backstops the `exerciseEntries` rule uses, so a session can always
 * write what a workout prescribes.
 */
export const WORKOUT_TARGET_MAX: Readonly<Record<MeasurementType, number>> = {
  reps: 10_000,
  time: 7_200,
  distance: 300_000,
  'distance-time': 300_000,
  weight: 0,
};

export type WorkoutRejection =
  | 'title'
  | 'description'
  | 'no-exercises'
  | 'too-many-exercises'
  | 'exercise' // unknown catalog id, unknown variant, or a weight-measured exercise
  | 'target' // not a positive integer within the measurement's cap
  | 'sets' // sets present but not positive integers summing to the target
  | 'limit'; // the owner already keeps MAX_WORKOUTS

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Why one exercise line cannot be part of a workout, or `null` when it
 * can. Weight-measured exercises are refused because a target in reps
 * says nothing about the load, and the session could not write an entry
 * for it.
 */
export function workoutExerciseRejection(
  value: unknown
): Exclude<WorkoutRejection, 'title' | 'description' | 'limit'> | null {
  if (!isPlainObject(value)) return 'exercise';
  const exerciseId = value['exerciseId'];
  const def =
    typeof exerciseId === 'string' ? findExerciseDefinition(exerciseId) : null;
  if (!def || def.measurement === 'weight') return 'exercise';
  const variantId = value['variantId'];
  if (variantId !== undefined && !isKnownVariant(def, variantId)) {
    return 'exercise';
  }
  const target = value['target'];
  if (!isPositiveInt(target) || target > WORKOUT_TARGET_MAX[def.measurement]) {
    return 'target';
  }
  const sets = value['sets'];
  if (sets !== undefined) {
    if (
      !Array.isArray(sets) ||
      sets.length === 0 ||
      sets.length > WORKOUT_MAX_SETS ||
      !sets.every(isPositiveInt) ||
      sets.reduce((sum: number, v: number) => sum + v, 0) !== target
    ) {
      return 'sets';
    }
  }
  return null;
}

function isKnownVariant(def: ExerciseDefinition, variantId: unknown): boolean {
  if (typeof variantId !== 'string' || variantId === '') return false;
  if (def.allowsCustomVariants) return true;
  return def.variants?.some((v) => v.id === variantId) ?? false;
}

/**
 * Whether these inputs make a workout. Shared between the editor (so it
 * can refuse early) and every consumer that reads a workout document
 * written by someone else. `count` is how many workouts the owner
 * already keeps, not counting the one being edited.
 */
export function workoutRejection(
  input: unknown,
  options: { readonly count: number }
): WorkoutRejection | null {
  if (!isPlainObject(input)) return 'title';
  const title = input['title'];
  if (
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    title.length > WORKOUT_TITLE_MAX
  ) {
    return 'title';
  }
  const description = input['description'];
  if (
    description !== undefined &&
    (typeof description !== 'string' ||
      description.length > WORKOUT_DESCRIPTION_MAX)
  ) {
    return 'description';
  }
  const exercises = input['exercises'];
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return 'no-exercises';
  }
  if (exercises.length > WORKOUT_MAX_EXERCISES) return 'too-many-exercises';
  for (const exercise of exercises) {
    const rejection = workoutExerciseRejection(exercise);
    if (rejection) return rejection;
  }
  if (options.count >= MAX_WORKOUTS) return 'limit';
  return null;
}

/**
 * A workout document as read back, or `null` when it is not one. Every
 * reader of another user's workout goes through this: the owner can
 * write anything into their own document, and a profile visitor's page
 * must not break on it. Unknown fields are dropped.
 */
export function normalizeWorkout(id: string, raw: unknown): Workout | null {
  if (!isPlainObject(raw)) return null;
  if (workoutRejection(raw, { count: 0 })) return null;
  const ownerId = raw['ownerId'];
  if (typeof ownerId !== 'string' || ownerId === '') return null;
  const exercises = (
    raw['exercises'] as ReadonlyArray<TrainingPlanExercise>
  ).map((e) => ({
    exerciseId: e.exerciseId,
    target: e.target,
    ...(e.variantId ? { variantId: e.variantId } : {}),
    ...(e.sets ? { sets: [...e.sets] } : {}),
  }));
  return {
    id,
    ownerId,
    title: (raw['title'] as string).trim(),
    description:
      typeof raw['description'] === 'string' ? raw['description'] : '',
    exercises,
    onProfile: raw['onProfile'] === true,
    ...(normalizeSource(raw['sharedBy'])
      ? { sharedBy: normalizeSource(raw['sharedBy']) as WorkoutSource }
      : {}),
    createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : '',
    updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : '',
  };
}

function normalizeSource(value: unknown): WorkoutSource | null {
  if (!isPlainObject(value)) return null;
  const uid = value['uid'];
  const workoutId = value['workoutId'];
  if (typeof uid !== 'string' || typeof workoutId !== 'string') return null;
  const displayName = value['displayName'];
  return {
    uid,
    workoutId,
    displayName: typeof displayName === 'string' ? displayName : null,
  };
}

// Cached per workout object so computed signals reading the day keep
// referential stability, the same way `planDayExercises` caches.
const days = new WeakMap<Workout, TrainingPlanDay>();

/**
 * The workout as a plan day, so the guided session's fulfillment layer
 * (`planDayProgress`, `buildSessionSteps`, `buildCircuitSteps`) walks it
 * without knowing workouts exist. Day 1 of a one-day plan; `targetReps`
 * is the pushup portion, as on every catalog day.
 */
export function workoutToPlanDay(workout: Workout): TrainingPlanDay {
  const cached = days.get(workout);
  if (cached) return cached;
  const day: TrainingPlanDay = {
    dayIndex: 1,
    kind: 'main',
    targetReps: workout.exercises
      .filter((e) => e.exerciseId === 'pushup')
      .reduce((sum, e) => sum + e.target, 0),
    exercises: workout.exercises,
    description: workout.description,
  };
  days.set(workout, day);
  return day;
}

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
