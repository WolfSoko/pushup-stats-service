import {
  COMPANION_BOUNDS,
  ExerciseDefinition,
  findExerciseWikiEntry,
  formatExerciseValue,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';

/**
 * Wiki-link target for the selected exercise. Returns the detail-page
 * route if the exercise has a wiki entry, else the list page so the help
 * icon never becomes a dead-end.
 */
export function exerciseWikiLink(exerciseId: string): string[] {
  const entry = findExerciseWikiEntry(exerciseId);
  return entry ? ['/wiki/uebungen', entry.slug] : ['/wiki/uebungen'];
}

export function exerciseWikiTooltip(exerciseId: string): string {
  const entry = findExerciseWikiEntry(exerciseId);
  if (!entry) {
    return $localize`:@@exerciseWikiLinkTooltip.generic:Anleitung zu Übungen öffnen`;
  }
  const template = $localize`:@@exerciseWikiLinkTooltip.specific:Anleitung öffnen`;
  return `${template}: ${exerciseDisplayName(entry.id)}`;
}

export function formattedExerciseMax(
  def: ExerciseDefinition | null,
  repsMax: number
): string {
  if (!def) return String(repsMax);
  return formatExerciseValue(def.max, def.unit);
}

export function formattedDurationMax(): string {
  return formatExerciseValue(COMPANION_BOUNDS.durationSec.max, 's');
}
