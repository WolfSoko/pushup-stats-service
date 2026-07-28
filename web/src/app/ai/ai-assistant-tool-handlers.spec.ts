import { signal } from '@angular/core';
import { EXERCISE_CATALOG } from '@pu-stats/models';
import { appRoutes } from '../app.routes';
import type { AppDataFacade } from '../core/app-data.facade';
import type { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import {
  buildTrainingSummary,
  loggableExercises,
  logExerciseEntry,
  NAVIGATION_TARGETS,
} from './ai-assistant-tool-handlers';

function makeQuickAddMock() {
  return {
    addSuggestion: vitest.fn(),
  } as unknown as QuickAddOrchestrationService & {
    addSuggestion: ReturnType<typeof vitest.fn>;
  };
}

describe('loggableExercises', () => {
  it('should expose every rep-based catalog exercise with its bounds', () => {
    // given
    const expectedIds = EXERCISE_CATALOG.filter(
      (definition) => definition.measurement === 'reps'
    ).map((definition) => definition.id);

    // when
    const exercises = loggableExercises();

    // then
    expect(exercises.map((exercise) => exercise.id)).toEqual(expectedIds);
    expect(exercises.every((exercise) => exercise.name.length > 0)).toBe(true);
    expect(exercises.every((exercise) => exercise.min <= exercise.max)).toBe(
      true
    );
  });

  it('should not offer exercises measured in time or distance', () => {
    // given
    const nonRepIds = EXERCISE_CATALOG.filter(
      (definition) => definition.measurement !== 'reps'
    ).map((definition) => definition.id);

    // when
    const offeredIds = loggableExercises().map((exercise) => exercise.id);

    // then
    expect(offeredIds.filter((id) => nonRepIds.includes(id))).toEqual([]);
  });
});

describe('logExerciseEntry', () => {
  it('should queue a quick-add entry for a valid rep-based exercise', () => {
    // given
    const quickAdd = makeQuickAddMock();

    // when
    const result = logExerciseEntry(quickAdd, 'pushup', 20);

    // then
    expect(result).toEqual({ ok: true, exerciseId: 'pushup', reps: 20 });
    expect(quickAdd.addSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: 'pushup', reps: 20 })
    );
  });

  it('should reject an unknown exercise id without writing anything', () => {
    // given
    const quickAdd = makeQuickAddMock();

    // when
    const result = logExerciseEntry(quickAdd, 'not-an-exercise', 20);

    // then
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not-an-exercise');
    expect(quickAdd.addSuggestion).not.toHaveBeenCalled();
  });

  it('should reject a time-based exercise that has no rep count', () => {
    // given
    const quickAdd = makeQuickAddMock();
    const timeExercise = EXERCISE_CATALOG.find(
      (definition) => definition.measurement === 'time'
    );

    // when
    const result = logExerciseEntry(quickAdd, timeExercise?.id ?? '', 30);

    // then
    expect(result.ok).toBe(false);
    expect(quickAdd.addSuggestion).not.toHaveBeenCalled();
  });

  it('should reject rep counts outside the exercise bounds', () => {
    // given
    const quickAdd = makeQuickAddMock();
    const pushup = EXERCISE_CATALOG.find(
      (definition) => definition.id === 'pushup'
    );

    // when
    const tooMany = logExerciseEntry(
      quickAdd,
      'pushup',
      (pushup?.max ?? 0) + 1
    );
    const fractional = logExerciseEntry(quickAdd, 'pushup', 12.5);

    // then
    expect(tooMany.ok).toBe(false);
    expect(fractional.ok).toBe(false);
    expect(quickAdd.addSuggestion).not.toHaveBeenCalled();
  });
});

describe('buildTrainingSummary', () => {
  it('should project the facade signals into a plain agent-readable payload', () => {
    // given
    const appData = {
      dailyGoal: signal(100),
      todayProgress: signal(42),
      remainingToGoal: signal(58),
      goalReached: signal(false),
      dailyGoalBreakdown: signal([
        {
          id: 'pushup',
          exerciseName: 'Liegestütze',
          targetDisplay: '100',
          progressDisplay: '42',
          percent: 42,
          reached: false,
        },
      ]),
    } as unknown as AppDataFacade;

    // when
    const summary = buildTrainingSummary(appData);

    // then
    expect(summary).toEqual({
      dailyGoal: 100,
      todayProgress: 42,
      remainingToGoal: 58,
      goalReached: false,
      goals: [
        {
          exercise: 'Liegestütze',
          target: '100',
          progress: '42',
          percent: 42,
        },
      ],
    });
  });
});

describe('NAVIGATION_TARGETS', () => {
  it('should only point at absolute in-app paths', () => {
    // given / when
    const paths = Object.values(NAVIGATION_TARGETS);

    // then
    expect(paths.every((path) => path.startsWith('/'))).toBe(true);
  });

  it('should stay in lockstep with the routes the app actually declares', () => {
    // given — a renamed route in app.routes.ts would otherwise leave the agent
    // navigating to a dead path with no test failing.
    const declaredPaths = new Set(
      appRoutes.map((route) => `/${route.path ?? ''}`)
    );

    // when
    const missing = Object.values(NAVIGATION_TARGETS).filter(
      (path) => !declaredPaths.has(path)
    );

    // then
    expect(missing).toEqual([]);
  });
});
