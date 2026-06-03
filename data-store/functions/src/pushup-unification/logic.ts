/**
 * Pure logic for the staged, reversible `pushups` → `exerciseEntries`
 * migration (issue #432). NO firebase imports — every export here is a
 * pure function so it can be unit-tested without firebase-admin mocks or
 * an emulator (see `docs/gotchas/testing.md`). The triggers/callables in
 * `src/index.ts` are thin wrappers around these planners.
 */

const PUSHUP_EXERCISE_ID = 'pushup';
const MIGRATED_FROM = 'pushups';
const DEFAULT_SOURCE = 'web';

/**
 * The staged migration copies pushups into `exerciseEntries` with
 * `exerciseId:'pushup'`. Until the Phase-7 write-path flip, the
 * per-exercise stats and leaderboard triggers must ignore those copies
 * so they don't create a `perExercise/pushup` aggregate or a pushup
 * leaderboard row (the Pushup dashboard still reads the legacy `pushups`
 * collection + its own `userStats` doc). Reversible: deleting this guard
 * at cutover re-enables aggregation for `exerciseId:'pushup'`.
 */
export function shouldAggregateExerciseEntry(
  exerciseId: string | undefined | null
): boolean {
  return exerciseId !== PUSHUP_EXERCISE_ID;
}

export interface PushupSourceDoc {
  id: string;
  userId?: string;
  timestamp?: string;
  reps?: unknown;
  sets?: unknown;
  source?: string;
  type?: string;
  createdAt?: string;
}

/** Dest `exerciseEntries` data shape (no `_id` — the doc id is the key). */
export interface MigratedEntryDoc {
  userId: string;
  exerciseId: 'pushup';
  timestamp: string;
  reps: number;
  source: string;
  sets?: number[];
  /** Provenance marker; rollback only deletes docs carrying it. */
  migratedFrom: 'pushups';
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns the input as a `number[]` of finite, positive integers. Any
 * non-array, non-numeric, or out-of-shape value is dropped. Mirrors the
 * spirit of `sanitizeSetsArray` in `index.ts` but is re-implemented here
 * so the pure logic stays free of `index.ts` imports.
 */
function sanitizeSets(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const out: number[] = [];
  for (const v of input) {
    if (typeof v !== 'number') continue;
    if (!Number.isFinite(v) || !Number.isInteger(v)) continue;
    if (v <= 0) continue;
    out.push(v);
  }
  return out;
}

/**
 * Maps one source pushup doc to its dest `exerciseEntries` payload.
 *
 * The legacy pushup variant (`type`) is intentionally dropped — the
 * unified `ExerciseEntry` schema has no pushup-variant field. See the
 * runbook (`docs/migrations/pushup-unification.md`).
 */
export function pushupToExerciseEntry(
  src: PushupSourceDoc,
  nowIso: string
): { destId: string; data: MigratedEntryDoc } | { skip: 'invalid' } {
  if (
    !src.userId ||
    !src.timestamp ||
    typeof src.reps !== 'number' ||
    !Number.isFinite(src.reps) ||
    !Number.isInteger(src.reps) ||
    src.reps <= 0
  ) {
    return { skip: 'invalid' };
  }

  // Reusing the source id makes the copy idempotent under `set()` and
  // makes rollback exact (delete the same ids we wrote).
  const destId = src.id;
  const sets = sanitizeSets(src.sets);

  const data: MigratedEntryDoc = {
    userId: src.userId,
    exerciseId: PUSHUP_EXERCISE_ID,
    timestamp: src.timestamp,
    reps: src.reps,
    source: src.source ?? DEFAULT_SOURCE,
    migratedFrom: MIGRATED_FROM,
    createdAt: src.createdAt ?? nowIso,
    updatedAt: nowIso,
    ...(sets.length > 0 ? { sets } : {}),
  };

  return { destId, data };
}

export interface MigrationPlan {
  toWrite: { destId: string; data: MigratedEntryDoc }[];
  skippedExisting: string[];
  skippedInvalid: string[];
}

/**
 * Pure classifier shared by the dry-run and the commit paths so both see
 * identical copy/skip decisions. A source whose destId already exists is
 * skipped (idempotent re-run), an invalid source is dropped, everything
 * else is queued for write.
 */
export function planMigration(
  sources: PushupSourceDoc[],
  existingDestIds: ReadonlySet<string>,
  nowIso: string
): MigrationPlan {
  const toWrite: { destId: string; data: MigratedEntryDoc }[] = [];
  const skippedExisting: string[] = [];
  const skippedInvalid: string[] = [];

  for (const src of sources) {
    const mapped = pushupToExerciseEntry(src, nowIso);
    if ('skip' in mapped) {
      skippedInvalid.push(src.id);
      continue;
    }
    if (existingDestIds.has(mapped.destId)) {
      skippedExisting.push(mapped.destId);
      continue;
    }
    toWrite.push(mapped);
  }

  return { toWrite, skippedExisting, skippedInvalid };
}

/**
 * Defense-in-depth for rollback: from the candidate dest docs, return
 * only ids that carry `migratedFrom:'pushups'` so a rollback can never
 * delete a natively-created `exerciseEntries` doc.
 */
export function rollbackTargets(
  migratedDocs: { id: string; migratedFrom?: string }[]
): string[] {
  return migratedDocs
    .filter((doc) => doc.migratedFrom === MIGRATED_FROM)
    .map((doc) => doc.id);
}
