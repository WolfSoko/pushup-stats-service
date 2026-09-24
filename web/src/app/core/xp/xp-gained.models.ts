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
  const lines: XpGainedLine[] = [];
  let xp = 0;
  for (const entry of entries) {
    if (!entry?.exerciseId) continue;
    const gained = previewXp(entry);
    if (!(gained > 0)) continue;
    xp += gained;
    const definition = findExerciseDefinition(entry.exerciseId);
    lines.push({
      label: exerciseDisplayName(entry.exerciseId),
      value: definition
        ? formatEntryDisplay(
            {
              reps: entry.reps ?? undefined,
              durationSec: entry.durationSec ?? undefined,
              distanceM: entry.distanceM ?? undefined,
            },
            definition
          )
        : '',
      xp: gained,
    });
  }
  if (xp <= 0) return null;
  const before = Math.max(0, totalBefore);
  return {
    xp,
    before: levelProgress(before),
    after: levelProgress(before + xp),
    lines: mergeLines(lines).slice(0, MAX_XP_LINES),
    titleId,
  };
}

/** A session logs one exercise in several steps; show it as one row. */
function mergeLines(lines: ReadonlyArray<XpGainedLine>): XpGainedLine[] {
  const byLabel = new Map<string, XpGainedLine & { count: number }>();
  for (const line of lines) {
    const existing = byLabel.get(line.label);
    byLabel.set(
      line.label,
      existing
        ? { ...existing, xp: existing.xp + line.xp, count: existing.count + 1 }
        : { ...line, count: 1 }
    );
  }
  return [...byLabel.values()]
    .map(({ count, ...line }) =>
      count > 1 ? { ...line, value: `${count}×` } : line
    )
    .sort((a, b) => b.xp - a.xp);
}
