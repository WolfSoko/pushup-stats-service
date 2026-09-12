import { describe, expect, it } from '@jest/globals';

import { findExerciseDefinition } from './exercise.catalog';
import { TRAINING_PLANS } from './training-plan.catalog';
import {
  MAX_PLAN_SCALE,
  MIN_PLAN_SCALE,
  scaleTrainingPlanDay,
  type PlanScaleFactors,
} from './training-plan-scaling';
import type { TrainingPlan, TrainingPlanDay } from './training-plan.models';

/**
 * A day's description is a hand-written, translated sentence; its exercise
 * list is computed and rescaled by the user's opening test. A number that
 * appears in both can therefore drift apart — and did: "3×20 s Hollow
 * Hold" stood above items of 10 s.
 *
 * The rule this pins: a scalable plan's description must not state a
 * number that scaling can move. Relative wording ("3 Sätze à 70 %",
 * "3×AMRAP") and numbers scaling never touches stay welcome.
 */

/**
 * Numbers the text states as a quantity of work, in the unit the items
 * are measured in.
 *
 * Three kinds of number are *not* prescriptions and stay allowed, because
 * nothing in the exercise list carries them: a percentage is relative by
 * definition, a round count is the day's structure, and a rest interval
 * is how it is executed.
 */
function describedNumbers(description: string): ReadonlySet<number> {
  const text = description
    .replace(/\d+\s*%/g, '')
    .replace(/\d+\s*Runden?/g, '')
    .replace(/\d+\s*(s|min)\s+Pause/g, '');
  const found = new Set<number>();
  for (const match of text.matchAll(/(\d+)\s*(min|s)?\b/g)) {
    const value = Number(match[1]);
    found.add(value);
    if (match[2] === 'min') found.add(value * 60);
  }
  return found;
}

/** Every number a day prescribes, before scaling. */
function prescribedNumbers(day: TrainingPlanDay): ReadonlyArray<number> {
  const items = day.exercises ?? [];
  return [
    day.targetReps,
    ...(day.sets ?? []),
    ...items.flatMap((item) => [item.target, ...(item.sets ?? [])]),
  ];
}

function movedNumbers(
  day: TrainingPlanDay,
  factors: PlanScaleFactors
): ReadonlySet<number> {
  const scaled = scaleTrainingPlanDay(day, factors);
  const before = prescribedNumbers(day);
  const after = prescribedNumbers(scaled);
  const moved = new Set<number>();
  before.forEach((value, index) => {
    if (after[index] !== value) moved.add(value);
  });
  return moved;
}

function factors(byExercise: Record<string, number>): PlanScaleFactors {
  return {
    primary: byExercise['pushup'] ?? 1,
    byExercise: new Map(Object.entries(byExercise)),
  };
}

describe('plan day descriptions', () => {
  const scalable = TRAINING_PLANS.filter(
    (p) => p.baselineMax
  ) as TrainingPlan[];

  it('should never state a number the opening test can move', () => {
    const offenders: string[] = [];
    for (const plan of scalable) {
      // Every exercise the plan names a baseline for gets a factor, plus
      // the push-up factor that drives `targetReps`.
      const probes = [MIN_PLAN_SCALE, MAX_PLAN_SCALE].map((scale) =>
        factors(
          Object.fromEntries(
            Object.keys(plan.baselineMax ?? {}).map((id) => [id, scale])
          )
        )
      );
      for (const day of plan.days) {
        const described = describedNumbers(day.description);
        for (const probe of probes) {
          for (const value of movedNumbers(day, probe)) {
            if (!described.has(value)) continue;
            offenders.push(
              `${plan.slug} day ${day.dayIndex}: "${day.description}" states ${value}`
            );
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('should cover the plans that can scale at all', () => {
    // given — the guard above is only meaningful while such plans exist
    expect(scalable.length).toBeGreaterThan(0);
    for (const plan of scalable) {
      for (const item of plan.days.flatMap((d) => d.exercises ?? [])) {
        expect(findExerciseDefinition(item.exerciseId)).not.toBeNull();
      }
    }
  });
});
