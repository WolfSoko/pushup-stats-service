import {
  findExerciseDefinition,
  formatEntryDisplay,
  levelProgress,
  type LevelProgress,
  type XpEntryInput,
} from '@pu-stats/models';

import { exerciseDisplayName } from '../../stats/i18n/exercise-display-names';

export interface XpGainedLine {
  readonly label: string;
  readonly value: string;
  readonly xp: number;
}

export interface XpGainedDialogData {
  readonly xp: number;
  readonly before: LevelProgress;
  readonly after: LevelProgress;
  readonly lines: ReadonlyArray<XpGainedLine>;
  /** DOM id of the headline, unique per dialog for `ariaLabelledBy`. */
  readonly titleId: string;
}

interface ExerciseSum {
  exerciseId: string;
  reps: number;
  durationSec: number;
  distanceM: number;
  xp: number;
}

/** Summary rows shown under the big number; a session is capped to stay short. */
export const MAX_XP_LINES = 4;

/**
 * Builds what the dialog shows for a set of just-saved entries, or `null`
 * when they are worth nothing (unknown exercise, zero rate) — no dialog
 * then, the caller falls back to its plain confirmation.
 */
export function buildXpGainedData(
  entries: ReadonlyArray<XpEntryInput | null | undefined>,
  previewXp: (entry: XpEntryInput) => number,
  totalBefore: number,
  titleId: string
): XpGainedDialogData | null {
  const byExercise = new Map<string, ExerciseSum>();
  let xp = 0;
  for (const entry of entries) {
    if (!entry?.exerciseId) continue;
    const gained = previewXp(entry);
    if (!(gained > 0)) continue;
    xp += gained;
    const sum = byExercise.get(entry.exerciseId) ?? {
      exerciseId: entry.exerciseId,
      reps: 0,
      durationSec: 0,
      distanceM: 0,
      xp: 0,
    };
    sum.reps += entry.reps ?? 0;
    sum.durationSec += entry.durationSec ?? 0;
    sum.distanceM += entry.distanceM ?? 0;
    sum.xp += gained;
    byExercise.set(entry.exerciseId, sum);
  }
  if (xp <= 0) return null;
  const before = Math.max(0, totalBefore);
  return {
    xp,
    before: levelProgress(before),
    after: levelProgress(before + xp),
    lines: [...byExercise.values()]
      .map(toLine)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, MAX_XP_LINES),
    titleId,
  };
}

/** A session logs one exercise in several steps; its row shows the sum. */
function toLine(sum: ExerciseSum): XpGainedLine {
  const definition = findExerciseDefinition(sum.exerciseId);
  return {
    label: exerciseDisplayName(sum.exerciseId),
    value: definition
      ? formatEntryDisplay(
          {
            reps: sum.reps || undefined,
            durationSec: sum.durationSec || undefined,
            distanceM: sum.distanceM || undefined,
          },
          definition
        )
      : '',
    xp: sum.xp,
  };
}
