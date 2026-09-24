import {
  findExerciseDefinition,
  findExerciseWikiEntry,
  findPushupTypeByStoredValue,
  localizeExerciseWiki,
  localizePushupType,
  localizePushupTypeSlug,
} from '@pu-stats/models';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../../stats/i18n/exercise-display-names';

/**
 * Everything a single, app-wide exercise reference needs to render: the
 * display name, a short description for a tooltip, and the wiki deep-link.
 * The one place that decides "pushup rows go to `/wiki/liegestuetz-typen`,
 * everything else to `/wiki/uebungen`" — previously duplicated between
 * `stats-table.format.ts` and `training-entry-dialog.display.ts`.
 *
 * Touches the generated wiki article content (name/summary per locale for
 * every exercise and pushup type), which is sizeable — callers reachable
 * from the eagerly-bundled app shell must load `app-exercise-ref` behind
 * an `@defer` block rather than call this from an eager template.
 */
export interface ExerciseRefData {
  readonly name: string;
  /** Null when the exercise/variant has no wiki entry to summarize. */
  readonly summary: string | null;
  /** Always a usable route — falls back to the wiki list page. */
  readonly wikiLink: readonly [string, string?];
}

const WIKI_CTA = $localize`:@@exerciseRef.tooltip.cta:Zum Wiki-Eintrag`;

/**
 * Tooltip text for an exercise reference: its short description (when the
 * wiki has one) plus a call to action, shared by every surface so the
 * hint reads the same everywhere it appears.
 */
export function exerciseRefTooltip(
  ref: Pick<ExerciseRefData, 'summary'>
): string {
  return ref.summary ? `${ref.summary} — ${WIKI_CTA}` : WIKI_CTA;
}

/**
 * The reference plus the how-to itself — the steps and tips of the wiki
 * article — for surfaces that show the instructions in place instead of
 * sending the user away (the session, the workout editor). Both lists are
 * empty when the exercise has no wiki entry.
 */
export interface ExerciseGuideData extends ExerciseRefData {
  readonly instructions: ReadonlyArray<string>;
  readonly tips: ReadonlyArray<string>;
}

export function resolveExerciseRef(
  exerciseId: string,
  variantId: string | null | undefined,
  locale: string
): ExerciseRefData {
  const { name, summary, wikiLink } = resolveExerciseGuide(
    exerciseId,
    variantId,
    locale
  );
  return { name, summary, wikiLink };
}

export function resolveExerciseGuide(
  exerciseId: string,
  variantId: string | null | undefined,
  locale: string
): ExerciseGuideData {
  if (exerciseId === 'pushup') {
    const type = findPushupTypeByStoredValue(variantId);
    if (!type) {
      return {
        name: exerciseDisplayName('pushup'),
        summary: null,
        wikiLink: ['/wiki/liegestuetz-typen'],
        instructions: [],
        tips: [],
      };
    }
    const localized = localizePushupType(type, locale);
    return {
      name: localized.name,
      summary: localized.summary,
      wikiLink: [
        '/wiki/liegestuetz-typen',
        localizePushupTypeSlug(type, locale),
      ],
      instructions: localized.instructions,
      tips: localized.tips,
    };
  }

  const def = findExerciseDefinition(exerciseId);
  const variant = def?.variants?.find((v) => v.id === variantId);
  const baseName = exerciseDisplayName(exerciseId);
  const name = variant
    ? `${baseName} · ${variantDisplayName(variant)}`
    : baseName;

  const wikiEntry = findExerciseWikiEntry(exerciseId);
  if (!wikiEntry) {
    return {
      name,
      summary: null,
      wikiLink: ['/wiki/uebungen'],
      instructions: [],
      tips: [],
    };
  }
  const localized = localizeExerciseWiki(wikiEntry, locale);
  return {
    name,
    summary: localized?.summary ?? null,
    wikiLink: ['/wiki/uebungen', wikiEntry.slug],
    instructions: localized?.instructions ?? [],
    tips: localized?.tips ?? [],
  };
}
