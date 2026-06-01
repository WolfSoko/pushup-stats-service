import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXERCISE_CATALOG, type MeasurementType } from '@pu-stats/models';

/**
 * Guards the hand-maintained exercise-id allowlists in
 * `data-store/firestore.rules` against `EXERCISE_CATALOG` — the single
 * source of truth in `@pu-stats/models`.
 *
 * Firestore rules can't import TypeScript, so the rule enumerates literal
 * ids in three allowlists grouped by the field a measurement writes:
 * `isRepsExerciseId` (reps), `isTimeExerciseId` (time),
 * `isDistanceTimeExerciseId` (distance-time). The rule's own comment says
 * "keep these in sync with the catalog" — this test makes that
 * machine-enforced instead of a promise. Without it, a freshly added
 * catalog exercise passes every other test yet hits permission-denied on
 * save in production because the rule never learned its id.
 *
 * Pushup variants are intentionally absent: they live in the legacy
 * `pushups` collection behind their own rule, not in `exerciseEntries`.
 */

const RULES_PATH = join(__dirname, '..', '..', 'firestore.rules');

/**
 * Extracts the single-quoted ids listed inside a `function <name>(id) { … }`
 * block in the rules file. Brace-matched so a trailing `}` inside a comment
 * can't truncate the body early.
 */
function ruleAllowlist(rules: string, fnName: string): Set<string> {
  const start = rules.indexOf(`function ${fnName}`);
  if (start < 0) throw new Error(`rule function "${fnName}" not found`);
  const open = rules.indexOf('{', start);
  if (open < 0)
    throw new Error(`no opening brace for rule function "${fnName}"`);
  let depth = 0;
  let end = -1;
  for (let i = open; i < rules.length; i++) {
    if (rules[i] === '{') depth++;
    else if (rules[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`unbalanced braces in "${fnName}"`);
  return new Set(
    [...rules.slice(open, end).matchAll(/'([^']+)'/g)].map((m) => m[1])
  );
}

function catalogIds(measurement: MeasurementType): string[] {
  return EXERCISE_CATALOG.filter((d) => d.measurement === measurement)
    .map((d) => d.id)
    .sort();
}

describe('firestore.rules exercise allowlists ⇄ EXERCISE_CATALOG', () => {
  const rules = readFileSync(RULES_PATH, 'utf8');

  it('should list exactly the catalog reps exercises in isRepsExerciseId', () => {
    // given
    const catalog = catalogIds('reps');
    // when
    const rule = [...ruleAllowlist(rules, 'isRepsExerciseId')].sort();
    // then
    expect(rule).toEqual(catalog);
  });

  it('should list exactly the catalog time exercises in isTimeExerciseId', () => {
    // given
    const catalog = catalogIds('time');
    // when
    const rule = [...ruleAllowlist(rules, 'isTimeExerciseId')].sort();
    // then
    expect(rule).toEqual(catalog);
  });

  it('should list exactly the catalog distance-time exercises in isDistanceTimeExerciseId', () => {
    // given
    const catalog = catalogIds('distance-time');
    // when
    const rule = [...ruleAllowlist(rules, 'isDistanceTimeExerciseId')].sort();
    // then
    expect(rule).toEqual(catalog);
  });

  it('should not ship a catalog measurement the rules have no allowlist for', () => {
    // given — `distance` (carry) and `weight` (strength) have no rule
    // allowlist yet, so a saved entry would hit no matching rule branch and
    // be denied. Mirrors the EXERCISE_CATALOG spec's "does not yet ship
    // distance/weight" guard from the rules-coverage side.
    const ruleCovered = new Set<MeasurementType>([
      'reps',
      'time',
      'distance-time',
    ]);
    // when
    const uncovered = EXERCISE_CATALOG.filter(
      (d) => !ruleCovered.has(d.measurement)
    ).map((d) => d.id);
    // then
    expect(uncovered).toEqual([]);
  });
});
