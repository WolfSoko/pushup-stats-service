import { SettingsAutoSaveController } from './settings-autosave.controller';
import type { AutoSaveDeps } from './settings-autosave.controller';
import type { DraftSnapshot, ResolvedConfig } from './settings-page.models';

const CONFIG: ResolvedConfig = {
  displayName: 'Wolf',
  hideFromLeaderboard: false,
  publicProfile: false,
  consent: { targetedAds: true },
  snapQuality: 'low',
};

const PERSISTED: DraftSnapshot = {
  displayName: 'Wolf',
  hideFromLeaderboard: false,
  publicProfile: false,
  adsConsent: true,
  snapQuality: 'low',
};

const DIRTY: DraftSnapshot = { ...PERSISTED, displayName: 'WolfEdited' };

const DEBOUNCE_MS = 600;

function makeDeps(overrides: Partial<AutoSaveDeps> = {}): {
  deps: AutoSaveDeps;
  save: ReturnType<typeof vitest.fn>;
  applyConfig: ReturnType<typeof vitest.fn>;
  onSaved: ReturnType<typeof vitest.fn>;
  draftRef: { current: DraftSnapshot };
} {
  const draftRef = { current: PERSISTED };
  const save = vitest.fn().mockResolvedValue({});
  const applyConfig = vitest.fn();
  const onSaved = vitest.fn();
  const deps: AutoSaveDeps = {
    readDraft: () => draftRef.current,
    readConfig: () => CONFIG,
    applyConfig,
    save,
    onSaved,
    isBrowser: true,
    ...overrides,
  };
  return { deps, save, applyConfig, onSaved, draftRef };
}

describe('SettingsAutoSaveController', () => {
  afterEach(() => {
    vitest.useRealTimers();
  });

  describe('hydrate', () => {
    it('should apply config and seed the baseline when no baseline exists yet', () => {
      // given
      const { deps, applyConfig } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);

      // when
      ctrl.hydrate(CONFIG);

      // then
      expect(applyConfig).toHaveBeenCalledWith(CONFIG);
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('should not clobber dirty drafts when a remote config arrives', () => {
      // given
      const { deps, applyConfig, draftRef } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      applyConfig.mockClear();
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY, null);

      // when
      ctrl.hydrate(CONFIG);

      // then
      expect(applyConfig).not.toHaveBeenCalled();
      ctrl.destroy();
    });

    it('should re-apply config when a remote config arrives over pristine drafts', () => {
      // given
      const { deps, applyConfig } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      applyConfig.mockClear();

      // when
      ctrl.hydrate(CONFIG);

      // then
      expect(applyConfig).toHaveBeenCalledWith(CONFIG);
    });
  });

  describe('onDraftChange', () => {
    it('should not schedule a save when a draft changes without a baseline', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);

      // when
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('should run save once when the debounce elapses on a dirty draft', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, save, draftRef } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY, null);
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
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      ctrl.onDraftChange(DIRTY, null);
      expect(ctrl.saveStatus()).toBe('pending');

      // when
      ctrl.onDraftChange(PERSISTED, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('should block save and keep status pending when an actively edited displayName is invalid', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);

      // when
      ctrl.onDraftChange(DIRTY, 'invalid-characters');
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('pending');
    });

    it('should still run save when another field is edited despite an invalid name from storage', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, save, draftRef } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      // displayName unchanged from baseline, only a flag differs
      const otherFieldDirty = { ...PERSISTED, publicProfile: true };
      draftRef.current = otherFieldDirty;

      // when
      ctrl.onDraftChange(otherFieldDirty, 'too-short');
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('save failure', () => {
    it('should set status to error when save rejects after the debounce elapses', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, draftRef } = makeDeps({
        save: vitest.fn().mockRejectedValue(new Error('down')),
      });
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(ctrl.saveStatus()).toBe('error');
    });

    it('should reset a stale error status to idle when the draft reverts to clean', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const { deps, draftRef } = makeDeps({
        save: vitest.fn().mockRejectedValue(new Error('down')),
      });
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('error');

      // when
      draftRef.current = PERSISTED;
      ctrl.onDraftChange(PERSISTED, null);

      // then
      expect(ctrl.saveStatus()).toBe('idle');
      ctrl.destroy();
    });
  });

  describe('onSaved side-effects', () => {
    it('should keep status saved when the onSaved callback throws', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      const onSaved = vitest.fn(() => {
        throw new Error('analytics boom');
      });
      const { deps, draftRef } = makeDeps({ onSaved });
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();

      // then
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(ctrl.saveStatus()).toBe('saved');
      ctrl.destroy();
    });
  });

  describe('drain', () => {
    it('should await the in-flight save before resolving', async () => {
      // given
      vitest.useFakeTimers({ shouldAdvanceTime: true });
      let resolveSave!: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const save = vitest.fn(() => savePromise);
      const { deps, draftRef } = makeDeps({ save });
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);
      await Promise.resolve();
      expect(ctrl.saveStatus()).toBe('saving');

      // when
      let drained = false;
      const drainPromise = ctrl.drain().then(() => {
        drained = true;
      });
      await Promise.resolve();

      // then
      expect(drained).toBe(false);
      resolveSave();
      await drainPromise;
      expect(drained).toBe(true);
      expect(save).toHaveBeenCalledTimes(1);
      ctrl.destroy();
    });

    it('should resolve immediately when no save is in flight', async () => {
      // given
      const { deps } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);

      // when / then
      await expect(ctrl.drain()).resolves.toBeUndefined();
    });
  });

  describe('SSR', () => {
    it('should not fire a timer-driven save on a non-browser platform', () => {
      // given
      vitest.useFakeTimers();
      const { deps, save, draftRef } = makeDeps({ isBrowser: false });
      const ctrl = new SettingsAutoSaveController(deps);
      ctrl.hydrate(CONFIG);
      draftRef.current = DIRTY;

      // when
      ctrl.onDraftChange(DIRTY, null);
      vitest.advanceTimersByTime(DEBOUNCE_MS);

      // then
      expect(save).not.toHaveBeenCalled();
      expect(ctrl.saveStatus()).toBe('pending');
    });
  });
});
