import {
  applyTrainingLine,
  type TrainingLine,
  type TrainingStats,
} from '@pu-stats/models';

/**
 * Moves the aggregate from an entry's old state to its new one, or
 * returns `null` when it has to be rebuilt from all entries: there is no
 * current aggregate yet, or the removal may have taken the best entry.
 */
export function nextTrainingStats(
  current: TrainingStats | null,
  removed: TrainingLine | null,
  added: TrainingLine | null
): TrainingStats | null {
  if (!current) return null;
  let next = current;
  if (removed) {
    const result = applyTrainingLine(next, removed, -1);
    if (result.needsRebuild) return null;
    next = result.stats;
  }
  return added ? applyTrainingLine(next, added, 1).stats : next;
}
