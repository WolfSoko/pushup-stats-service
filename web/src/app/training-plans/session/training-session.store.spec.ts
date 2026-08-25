import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PlanExerciseProgress,
  SESSION_REST_DEFAULT_SEC,
  SESSION_REST_MAX_SEC,
  type SessionMode,
  TrainingPlanDay,
  TrainingPlanExercise,
} from '@pu-stats/models';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../training-plan.store';
import { TrainingSessionStore } from './training-session.store';

const PLANK: TrainingPlanExercise = {
  exerciseId: 'plank.standard',
  target: 50,
};
const TWIST: TrainingPlanExercise = {
  exerciseId: 'abs.russiantwist',
  target: 20,
};
const PUSHUPS: TrainingPlanExercise = { exerciseId: 'pushup', target: 15 };

function item(
  itemIndex: number,
  exercise: TrainingPlanExercise,
  done = false,
  logged = 0
): PlanExerciseProgress {
  return {
    itemIndex,
    exercise,
    logged,
    fulfilledByEntries: done,
    checkedOff: false,
    done,
  };
}

const DAY: TrainingPlanDay = {
  dayIndex: 3,
  kind: 'main',
  targetReps: 15,
  description: 'Zirkel',
};

interface Harness {
  progress: ReturnType<typeof signal<PlanExerciseProgress[]>>;
  dayIndex: ReturnType<typeof signal<number | null>>;
  restSec: ReturnType<typeof signal<number>>;
  mode: ReturnType<typeof signal<SessionMode>>;
  saveRest: ReturnType<typeof vi.fn>;
  saveMode: ReturnType<typeof vi.fn>;
}

function setup(
  options: {
    progress?: PlanExerciseProgress[];
    dayIndex?: number | null;
    restSec?: number;
    mode?: SessionMode;
    platform?: string;
  } = {}
): { store: InstanceType<typeof TrainingSessionStore>; harness: Harness } {
  const harness: Harness = {
    progress: signal<PlanExerciseProgress[]>(
      options.progress ?? [item(0, PLANK), item(1, TWIST), item(2, PUSHUPS)]
    ),
    dayIndex: signal<number | null>(
      options.dayIndex === undefined ? 3 : options.dayIndex
    ),
    restSec: signal(options.restSec ?? SESSION_REST_DEFAULT_SEC),
    mode: signal<SessionMode>(options.mode ?? 'sequential'),
    saveRest: vi.fn().mockResolvedValue(undefined),
    saveMode: vi.fn().mockResolvedValue(undefined),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: options.platform ?? 'server' },
      {
        provide: TrainingPlanStore,
        useValue: {
          currentDayIndex: harness.dayIndex,
          todayDay: () => DAY,
          dayProgress: () => harness.progress(),
        },
      },
      {
        provide: UserConfigStore,
        useValue: {
          sessionRestSec: harness.restSec,
          saveSessionRestSec: harness.saveRest,
          sessionMode: harness.mode,
          saveSessionMode: harness.saveMode,
        },
      },
      TrainingSessionStore,
    ],
  });

  return { store: TestBed.inject(TrainingSessionStore), harness };
}

describe('TrainingSessionStore', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should derive one step per exercise of the active day', () => {
    // given
    const { store } = setup();

    // when
    const steps = store.steps();

    // then
    expect(steps.map((s) => s.exercise.exerciseId)).toEqual([
      'plank.standard',
      'abs.russiantwist',
      'pushup',
    ]);
    expect(steps.map((s) => s.tool)).toEqual([
      'hold-timer',
      'manual',
      'auto-count',
    ]);
  });

  it('should expose an empty step list when no plan day is active', () => {
    // given
    const { store } = setup({ dayIndex: null });

    // when / then
    expect(store.steps()).toEqual([]);
    expect(store.isEmptyDay()).toBe(true);
  });

  it('should start on the intro phase', () => {
    // given / when
    const { store } = setup();

    // then
    expect(store.phase()).toBe('intro');
  });

  it('should begin on the first open step', () => {
    // given
    const { store } = setup({
      progress: [item(0, PLANK, true), item(1, TWIST), item(2, PUSHUPS)],
    });

    // when
    store.begin();

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.stepIndex()).toBe(1);
  });

  it('should begin in the done phase when the day is already complete', () => {
    // given
    const { store } = setup({
      progress: [item(0, PLANK, true), item(1, TWIST, true)],
    });

    // when
    store.begin();

    // then
    expect(store.phase()).toBe('done');
    expect(store.allDone()).toBe(true);
  });

  it('should rest before the next step after completing one', () => {
    // given
    const { store } = setup();
    store.begin();

    // when
    store.completeStep();

    // then
    expect(store.phase()).toBe('rest');
    expect(store.stepIndex()).toBe(1);
    expect(store.restRemaining()).toBe(SESSION_REST_DEFAULT_SEC);
  });

  it('should go straight to the next step when rest is switched off', () => {
    // given
    const { store } = setup({ restSec: 0 });
    store.begin();

    // when
    store.completeStep();

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.restRemaining()).toBe(0);
  });

  it('should advance past the current step even before the entry reaches the mirror', () => {
    // given — the completed step still reads as open, as it does between
    // the write and the live mirror echoing it back
    const { store } = setup();
    store.begin();

    // when
    store.completeStep();

    // then
    expect(store.stepIndex()).toBe(1);
  });

  it('should finish the session when the completed step was the last open one', () => {
    // given
    const { store } = setup({
      progress: [item(0, PLANK, true), item(1, TWIST), item(2, PUSHUPS, true)],
    });
    store.begin();

    // when
    store.completeStep();

    // then
    expect(store.phase()).toBe('done');
  });

  it('should skip to the next step without resting', () => {
    // given
    const { store } = setup();
    store.begin();

    // when
    store.skipStep();

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.stepIndex()).toBe(1);
    expect(store.restRemaining()).toBe(0);
  });

  it('should jump to a step picked from the overview', () => {
    // given
    const { store } = setup();

    // when
    store.goToStep(2);

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.stepIndex()).toBe(2);
  });

  it('should ignore a jump to a step outside the day', () => {
    // given
    const { store } = setup();

    // when
    store.goToStep(9);

    // then
    expect(store.phase()).toBe('intro');
    expect(store.stepIndex()).toBe(0);
  });

  it('should end the rest early on request', () => {
    // given
    const { store } = setup();
    store.begin();
    store.completeStep();

    // when
    store.endRest();

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.restRemaining()).toBe(0);
  });

  it('should stretch the running countdown', () => {
    // given
    const { store } = setup({ restSec: 60 });
    store.begin();
    store.completeStep();

    // when
    store.nudgeRest(15);

    // then
    expect(store.restRemaining()).toBe(75);
  });

  it('should not let a nudge push the countdown below zero', () => {
    // given
    const { store } = setup({ restSec: 10 });
    store.begin();
    store.completeStep();

    // when
    store.nudgeRest(-30);

    // then
    expect(store.restRemaining()).toBe(0);
  });

  it('should end the rest when the countdown reaches zero', () => {
    // given
    const { store } = setup({ restSec: 2 });
    store.begin();
    store.completeStep();

    // when
    store.tickRest();
    store.tickRest();

    // then
    expect(store.phase()).toBe('exercise');
    expect(store.restRemaining()).toBe(0);
  });

  it('should ignore a tick outside the rest phase', () => {
    // given
    const { store } = setup();
    store.begin();

    // when
    store.tickRest();

    // then
    expect(store.phase()).toBe('exercise');
  });

  it('should follow the persisted rest duration until the user overrides it', () => {
    // given
    const { store, harness } = setup({ restSec: 90 });
    expect(store.restSec()).toBe(90);

    // when — a later config emission still wins while untouched
    harness.restSec.set(120);

    // then
    expect(store.restSec()).toBe(120);
  });

  it('should keep the chosen rest duration when the config emits afterwards', () => {
    // given
    const { store, harness } = setup({ restSec: 60 });
    store.setRestSec(30);

    // when
    harness.restSec.set(120);

    // then
    expect(store.restSec()).toBe(30);
  });

  it('should persist a chosen rest duration', () => {
    // given
    const { store, harness } = setup();

    // when
    store.setRestSec(45);

    // then
    expect(harness.saveRest).toHaveBeenCalledWith(45);
  });

  it('should clamp a chosen rest duration into the supported range', () => {
    // given
    const { store, harness } = setup();

    // when
    store.setRestSec(99_999);

    // then
    expect(store.restSec()).toBe(SESSION_REST_MAX_SEC);
    expect(harness.saveRest).toHaveBeenCalledWith(SESSION_REST_MAX_SEC);
  });

  it('should keep the session usable when persisting the rest duration fails', async () => {
    // given
    const { store, harness } = setup();
    harness.saveRest.mockRejectedValue(new Error('offline'));

    // when
    store.setRestSec(45);
    await Promise.resolve();

    // then
    expect(store.restSec()).toBe(45);
  });

  it('should report progress across the day', () => {
    // given
    const { store } = setup({
      progress: [item(0, PLANK, true), item(1, TWIST), item(2, PUSHUPS)],
    });

    // when / then
    expect(store.stepsDone()).toBe(1);
    expect(store.stepsTotal()).toBe(3);
    expect(store.allDone()).toBe(false);
  });

  it('should return to the intro on request', () => {
    // given
    const { store } = setup();
    store.begin();

    // when
    store.backToIntro();

    // then
    expect(store.phase()).toBe('intro');
  });
});

describe('TrainingSessionStore rest countdown', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should tick the rest down once a second in the browser', () => {
    // given
    vi.useFakeTimers();
    try {
      const { store } = setup({ platform: 'browser', restSec: 5 });
      TestBed.tick();
      store.begin();
      store.completeStep();
      TestBed.tick();

      // when
      vi.advanceTimersByTime(3000);

      // then
      expect(store.restRemaining()).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop ticking once the rest is over', () => {
    // given
    vi.useFakeTimers();
    try {
      const { store } = setup({ platform: 'browser', restSec: 2 });
      TestBed.tick();
      store.begin();
      store.completeStep();
      TestBed.tick();

      // when
      vi.advanceTimersByTime(10_000);
      TestBed.tick();

      // then
      expect(store.phase()).toBe('exercise');
      expect(store.restRemaining()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not start a timer on the server', () => {
    // given
    vi.useFakeTimers();
    try {
      const { store } = setup({ platform: 'server', restSec: 5 });
      store.begin();
      store.completeStep();

      // when
      vi.advanceTimersByTime(3000);

      // then
      expect(store.restRemaining()).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('circuit mode', () => {
    const CIRCUIT = [
      item(0, { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] }),
      item(1, { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] }),
    ];

    it('should walk one set of every exercise per round', () => {
      // given
      const { store } = setup({ progress: CIRCUIT, mode: 'circuit' });

      // when
      const steps = store.steps();

      // then
      expect(steps.map((s) => [s.exercise.exerciseId, s.roundTarget])).toEqual([
        ['pushup', 10],
        ['plank.standard', 30],
        ['pushup', 10],
        ['plank.standard', 30],
        ['pushup', 10],
        ['plank.standard', 30],
      ]);
      expect(store.roundTotal()).toBe(3);
    });

    it('should keep the start screen at one row per exercise', () => {
      // given
      const { store } = setup({ progress: CIRCUIT, mode: 'circuit' });

      // when
      const overview = store.overviewSteps();

      // then
      expect(overview.map((s) => s.exercise.exerciseId)).toEqual([
        'pushup',
        'plank.standard',
      ]);
    });

    it('should re-order the steps and restart when the mode is switched', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT });
      store.begin();
      store.completeStep();

      // when
      store.setMode('circuit');

      // then
      expect(store.mode()).toBe('circuit');
      expect(store.stepIndex()).toBe(0);
      expect(store.steps()).toHaveLength(6);
      expect(harness.saveMode).toHaveBeenCalledWith('circuit');
    });

    it('should keep working locally when persisting the mode fails', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT });
      harness.saveMode.mockRejectedValue(new Error('offline'));

      // when
      store.setMode('circuit');

      // then
      expect(store.mode()).toBe('circuit');
    });

    it('should ignore a switch to the mode already in use', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT, mode: 'circuit' });

      // when
      store.setMode('circuit');

      // then
      expect(harness.saveMode).not.toHaveBeenCalled();
    });

    it('should start on the first round that what is logged does not cover', () => {
      // given
      const { store } = setup({
        progress: [
          item(
            0,
            { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] },
            false,
            20
          ),
          item(1, {
            exerciseId: 'plank.standard',
            target: 90,
            sets: [30, 30, 30],
          }),
        ],
        mode: 'circuit',
      });

      // when
      store.begin();

      // then
      expect(store.currentStep()?.exercise.exerciseId).toBe('plank.standard');
      expect(store.currentStep()?.roundIndex).toBe(0);
    });

    it('should follow the persisted config mode until the session overrides it', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT });

      // when
      harness.mode.set('circuit');

      // then
      expect(store.mode()).toBe('circuit');

      // when
      store.setMode('sequential');
      harness.mode.set('circuit');

      // then
      expect(store.mode()).toBe('sequential');
    });
  });

  describe('late-arriving user config', () => {
    const CIRCUIT_DAY = [
      item(0, { exerciseId: 'pushup', target: 30, sets: [10, 10, 10] }),
      item(1, { exerciseId: 'plank.standard', target: 90, sets: [30, 30, 30] }),
    ];

    it('should not re-order a running session when the config resolves late', () => {
      // given — the session starts before the config doc arrives
      const { store, harness } = setup({ progress: CIRCUIT_DAY });
      store.begin();
      store.completeStep();
      const current = store.currentStep();

      // when
      harness.mode.set('circuit');

      // then
      expect(store.mode()).toBe('sequential');
      expect(store.currentStep()).toEqual(current);
    });

    it('should still take the config mode while the user is on the start screen', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT_DAY });

      // when
      harness.mode.set('circuit');

      // then
      expect(store.mode()).toBe('circuit');
      expect(store.steps()).toHaveLength(6);
    });

    it('should keep the pinned mode out of the persisted config', () => {
      // given
      const { store, harness } = setup({ progress: CIRCUIT_DAY });

      // when
      store.begin();

      // then — pinning is session-local, not a user choice
      expect(harness.saveMode).not.toHaveBeenCalled();
    });
  });
});
