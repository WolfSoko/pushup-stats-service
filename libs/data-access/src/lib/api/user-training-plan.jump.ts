import { UserTrainingPlan } from '@pu-stats/models';

/** Server state a jump reads before recomputing the skip set. */
export type JumpBaseline = Pick<
  UserTrainingPlan,
  'completedDays' | 'skippedDays'
> | null;

/**
 * Skip set after re-anchoring a plan to `targetDayIndex`. Keeps prior
 * skips that still sit before the new cursor, bulk-skips every non-rest
 * predecessor that isn't completed, and preserves completed days as-is
 * (even ones that end up in the future relative to the new `startDate`).
 *
 * Pure so the Firestore transaction that applies it stays a thin
 * read-compute-write shell.
 */
export function nextSkippedDays(
  baseline: JumpBaseline,
  args: {
    targetDayIndex: number;
    nonRestDaysBeforeTarget: ReadonlyArray<number>;
  }
): number[] {
  const completed = new Set<number>(baseline?.completedDays ?? []);
  const preservedPriorSkips = (baseline?.skippedDays ?? []).filter(
    (idx) => idx < args.targetDayIndex && !completed.has(idx)
  );
  const newlySkipped = args.nonRestDaysBeforeTarget.filter(
    (idx) => !completed.has(idx)
  );
  return Array.from(new Set([...preservedPriorSkips, ...newlySkipped])).sort(
    (x, y) => x - y
  );
}
