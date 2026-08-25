import { computed, Signal } from '@angular/core';
import {
  buildCircuitSteps,
  buildSessionSteps,
  firstOpenStepIndex,
  normalizeRestSec,
  normalizeSessionMode,
  type SessionMode,
  SessionStep,
  sessionStepsDone,
} from '@pu-stats/models';

import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../training-plan.store';

/** What the session store's derived state reads from. */
interface SessionSources {
  plan: InstanceType<typeof TrainingPlanStore>;
  config: InstanceType<typeof UserConfigStore>;
  stepIndex: Signal<number>;
  restOverride: Signal<number | null>;
  modeOverride: Signal<SessionMode | null>;
}

/**
 * Everything the session derives from the plan day and the user config.
 *
 * Kept out of the store file so the store stays the state machine: this
 * is all read-only projection, and none of it needs `patchState`.
 */
export function sessionSelectors(sources: SessionSources) {
  const dayIndex = computed(() => sources.plan.currentDayIndex());

  const mode = computed<SessionMode>(() =>
    normalizeSessionMode(sources.modeOverride() ?? sources.config.sessionMode())
  );

  /** The day's exercises, one step each — what the start screen lists
   *  regardless of the ordering the session will use. */
  const overviewSteps = computed<ReadonlyArray<SessionStep>>(() => {
    const idx = dayIndex();
    if (idx === null) return [];
    return buildSessionSteps(sources.plan.dayProgress(idx));
  });

  const steps = computed<ReadonlyArray<SessionStep>>(() => {
    const idx = dayIndex();
    if (idx === null || mode() !== 'circuit') return overviewSteps();
    return buildCircuitSteps(sources.plan.dayProgress(idx));
  });

  return {
    dayIndex,
    mode,
    overviewSteps,
    steps,
    currentStep: computed<SessionStep | null>(
      () => steps()[sources.stepIndex()] ?? null
    ),
    restSec: computed(() =>
      normalizeRestSec(
        sources.restOverride() ?? sources.config.sessionRestSec()
      )
    ),
    /** Rounds the circuit walks; 1 in sequential mode. */
    roundTotal: computed(() => steps()[0]?.roundTotal ?? 1),
    day: computed(() => sources.plan.todayDay()),
    stepsDone: computed(() => sessionStepsDone(steps())),
    stepsTotal: computed(() => steps().length),
    /** True when the day prescribes nothing trackable (a rest day). */
    isEmptyDay: computed(() => steps().length === 0),
    allDone: computed(
      () => steps().length > 0 && firstOpenStepIndex(steps()) === -1
    ),
  };
}
