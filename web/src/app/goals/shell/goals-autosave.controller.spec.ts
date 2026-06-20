import type { ComplexGoals } from '@pu-stats/models';
import {
  GoalsAutoSaveController,
  type GoalsAutoSaveDeps,
} from './goals-autosave.controller';

const PERSISTED: ComplexGoals = {
  daily: [
    {
      id: 'a',
      exerciseId: 'pushup',
      target: 10,
      measurement: 'reps',
      unit: 'reps',
    },
  ],
  weekly: [],
  monthly: [],
};

const DIRTY: ComplexGoals = {
  ...PERSISTED,
  daily: [
    {
      id: 'a',
      exerciseId: 'pushup',
      target: 25,
      measurement: 'reps',
      unit: 'reps',
    },
  ],
};

const DEBOUNCE_MS = 600;
const SAVED_INDICATOR_MS = 1800;

const DIRTIER: ComplexGoals = {
  ...PERSISTED,
  daily: [
    {
      id: 'a',
      exerciseId: 'pushup',
      target: 99,
      measurement: 'reps',
      unit: 'reps',
    },
  ],
};

function makeDeps(overrides: Partial<GoalsAutoSaveDeps> = {}): {
  deps: GoalsAutoSaveDeps;
  save: ReturnType<typeof vitest.fn>;
  applyDraft: ReturnType<typeof vitest.fn>;
  draftRef: { current: ComplexGoals };
} {
  const draftRef = { current: PERSISTED };
  const save = vitest.fn().mockResolvedValue({});
  const applyDraft = vitest.fn();
  const deps: GoalsAutoSaveDeps = {
    readDraft: () => draftRef.current,
    applyDraft,
    save,
    isBrowser: true,
    ...overrides,
  };
  return { deps, save, applyDraft, draftRef };
}

describe('GoalsAutoSaveController', () => {
  afterEach(() => {
    vitest.useRealTimers();
  });

  describe('hydrate', () => {
    it('should apply goals and seed the baseline when none exists yet', () => {
      // given
      const { deps, applyDraft } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);

      // when
      ctrl.hydrate(PERSISTED);

      // then
      expect(applyDraft).toHaveBeenCalledWith(PERSISTED);
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('should not clobber dirty drafts when a store emission arrives', () => {
      // given
      const { deps, applyDraft, draftRef } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      applyDraft.mockClear();
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY);

      // when
      ctrl.hydrate(PERSISTED);

      // then
      expect(applyDraft).not.toHaveBeenCalled();
      ctrl.destroy();
    });

    it('should re-apply goals when an emission arrives over pristine drafts', () => {
      // given
      const { deps, applyDraft } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      applyDraft.mockClear();

      // when
      ctrl.hydrate(PERSISTED);

      // then
      expect(applyDraft).toHaveBeenCalledWith(PERSISTED);
    });
  });

  describe('onDraftChange', () => {
    it('should not schedule a save without a baseline', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);

      // when
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('should run save once when the debounce elapses on a dirty draft', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, save, draftRef } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY);
      expect(ctrl.saveStatus()).toBe('pending');
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(save).toHaveBeenCalledTimes(1);
      expect(ctrl.saveStatus()).toBe('saved');
    });

    it('should return a pending status to idle when a draft reverts to the baseline', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      ctrl.onDraftChange(DIRTY);
      expect(ctrl.saveStatus()).toBe('pending');

      // when
      ctrl.onDraftChange(PERSISTED);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('idle');
    });
  });

  describe('save failure', () => {
    it('should set status to error when save rejects after the debounce elapses', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, draftRef } = makeDeps({
        save: vitest.fn().mockRejectedValue(new Error('down')),
      });
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(ctrl.saveStatus()).toBe('error');
    });

    it('should re-run the save when retry is called after a failure', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const save = vitest
        .fn()
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue({});
      const { deps, draftRef } = makeDeps({ save });
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('error');

      // when
      ctrl.retry();
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(save).toHaveBeenCalledTimes(2);
      expect(ctrl.saveStatus()).toBe('saved');
      ctrl.destroy();
    });

    it('should reset a stale error status to idle when the draft reverts to clean', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, draftRef } = makeDeps({
        save: vitest.fn().mockRejectedValue(new Error('down')),
      });
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('error');

      // when
      draftRef.current = PERSISTED;
      ctrl.onDraftChange(PERSISTED);

      // then
      expect(ctrl.saveStatus()).toBe('idle');
      ctrl.destroy();
    });
  });

  describe('saved indicator', () => {
    it('should return the saved status to idle after the indicator window elapses', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, draftRef } = makeDeps();
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('saved');

      // when
      vitest.advanceTimersByTime(SAVED_INDICATOR_MS);

      // then
      expect(ctrl.saveStatus()).toBe('idle');
      ctrl.destroy();
    });
  });

  describe('coalescing', () => {
    it('should run a second save for the newest draft when it changes mid-flight', async () => {
      // given a save whose first call we hold open
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      let resolveFirst!: () => void;
      const first = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      const save = vitest.fn().mockReturnValueOnce(first).mockResolvedValue({});
      const { deps, draftRef } = makeDeps({ save });
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('saving');

      // when a newer draft arrives before the first save resolves
      draftRef.current = DIRTIER;
      ctrl.onDraftChange(DIRTIER);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      resolveFirst();
      for (let i = 0; i < 6; i++) await Promise.resolve();

      // then the held save and a coalesced follow-up both run, latest last
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0].daily?.[0].target).toBe(99);
      expect(ctrl.saveStatus()).toBe('saved');
      ctrl.destroy();
    });
  });

  describe('SSR', () => {
    it('should not fire a timer-driven save on a non-browser platform', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save, draftRef } = makeDeps({ isBrowser: false });
      const ctrl = new GoalsAutoSaveController(deps);
      ctrl.hydrate(PERSISTED);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('pending');
    });
  });
});
