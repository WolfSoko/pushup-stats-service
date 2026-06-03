import {
  EXERCISE_CATALOG,
  EXERCISE_CATEGORIES,
  type MeasurementType,
} from '@pu-stats/models';

/**
 * Codegen for the three exercise-id allowlists in
 * `data-store/firestore.rules` (`isRepsExerciseId`, `isTimeExerciseId`,
 * `isDistanceTimeExerciseId`). Firestore rules can't import TypeScript, so
 * these literal id lists are the one place the catalog used to be copied by
 * hand. `renderRulesAllowlists` regenerates them from `EXERCISE_CATALOG`,
 * removing the last manual edit when adding an exercise.
 *
 * `exercise-rules-sync.spec.ts` only inspects the quoted ids per function,
 * so the category grouping and per-group comments here are cosmetic.
 */

export const RULE_FUNCTION_BY_MEASUREMENT: Record<
  'reps' | 'time' | 'distance-time',
  string
> = {
  reps: 'isRepsExerciseId',
  time: 'isTimeExerciseId',
  'distance-time': 'isDistanceTimeExerciseId',
};

const REGENERATE_COMMAND =
  'pnpm nx run cloud-functions:generate-exercise-rules';

/**
 * Catalog ids for one measurement, sorted — identical ordering to the
 * guard test's `catalogIds` so the rendered list and the comparison agree.
 */
export function catalogIdsForMeasurement(
  measurement: MeasurementType
): string[] {
  return EXERCISE_CATALOG.filter((d) => d.measurement === measurement)
    .map((d) => d.id)
    .sort();
}

interface CategoryGroup {
  categoryId: string;
  ids: string[];
}

/**
 * Catalog ids for a measurement, bucketed by category. Buckets follow
 * `EXERCISE_CATEGORIES` declaration order (iterated outer); ids within a
 * bucket are sorted. Empty buckets are dropped. Drives the readable
 * grouping in the generated rule body.
 */
export function groupedCatalogIdsForMeasurement(
  measurement: MeasurementType
): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const category of EXERCISE_CATEGORIES) {
    const ids = EXERCISE_CATALOG.filter(
      (d) => d.measurement === measurement && d.categoryId === category.id
    )
      .map((d) => d.id)
      .sort();
    if (ids.length > 0) groups.push({ categoryId: category.id, ids });
  }
  return groups;
}

function renderGeneratedBody(
  fnName: string,
  measurement: 'reps' | 'time' | 'distance-time',
  indent: string
): string {
  const groups = groupedCatalogIdsForMeasurement(measurement);
  const lines: string[] = [
    `${indent}// BEGIN GENERATED ${fnName} (source: EXERCISE_CATALOG; run: ${REGENERATE_COMMAND})`,
  ];
  groups.forEach((group, index) => {
    lines.push(`${indent}// ${group.categoryId}`);
    // No trailing comma after the final group: Firestore Rules list literals
    // are not reliably trailing-comma tolerant, and the hand-written original
    // had none.
    const separator = index === groups.length - 1 ? '' : ',';
    lines.push(
      `${indent}${group.ids.map((id) => `'${id}'`).join(', ')}${separator}`
    );
  });
  lines.push(`${indent}// END GENERATED ${fnName}`);
  return lines.join('\n');
}

/**
 * Matches a whole `function <name>(id) { return [ <body> ].hasAny([id]); }`
 * block. Group 1 is the prefix up to and including `return [\n`, group 2 is
 * the first body line's indentation (reused for the generated lines so they
 * align with the surrounding style), group 3 is the rest of the list body,
 * group 4 is the `.hasAny` scaffold. Only the body is replaced; the same
 * regex matches whether or not the body already carries the BEGIN/END
 * markers (idempotent regeneration).
 */
function ruleFunctionRegExp(fnName: string): RegExp {
  return new RegExp(
    `(function ${fnName}\\(id\\) \\{\\s*\\n\\s*return \\[\\n)` +
      `([ \\t]*)` +
      `([\\s\\S]*?)` +
      `(\\n\\s*\\]\\.hasAny\\(\\[id\\]\\);)`,
    'm'
  );
}

/**
 * Rewrites the id list of each of the three allowlist functions in
 * `currentRules` from `EXERCISE_CATALOG`, leaving everything else — file
 * header, other rules, `.hasAny` scaffold — byte-for-byte intact. Idempotent.
 */
export function renderRulesAllowlists(currentRules: string): string {
  let next = currentRules;
  for (const [measurement, fnName] of Object.entries(
    RULE_FUNCTION_BY_MEASUREMENT
  ) as [keyof typeof RULE_FUNCTION_BY_MEASUREMENT, string][]) {
    const regExp = ruleFunctionRegExp(fnName);
    const match = next.match(regExp);
    if (!match) {
      throw new Error(
        `rule function "${fnName}" not found or has unexpected shape`
      );
    }
    const indent = match[2];
    const body = renderGeneratedBody(fnName, measurement, indent);
    next = next.replace(
      regExp,
      (
        _full,
        prefix: string,
        _indent: string,
        _oldBody: string,
        tail: string
      ) => `${prefix}${body}${tail}`
    );
  }
  return next;
}
