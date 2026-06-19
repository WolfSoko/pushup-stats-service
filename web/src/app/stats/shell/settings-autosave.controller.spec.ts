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
    it('Given no baseline yet, When hydrate runs, Then it applies config and seeds the baseline', () => {
      // given
      const { deps, applyConfig } = makeDeps();
      const ctrl = new SettingsAutoSaveController(deps);

      // when
      ctrl.hydrate(CONFIG);

      // then
      expect(applyConfig).toHaveBeenCalledWith(CONFIG);
      expect(ctrl.saveStatus()).toBe('idle');
    });

    it('Given dirty drafts, When a remote config arrives, Then it does not clobber the drafts', () => {
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

    it('Given pristine drafts after a baseline, When a remote config arrives, Then it re-applies config', () => {
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
    it('Given no baseline, When a draft changes, Then no save is scheduled', () => {
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

    it('Given a dirty draft, When the debounce elapses, Then save runs once', async () => {
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

    it('Given a draft reverted to the baseline, When changed, Then a pending status returns to idle', () => {
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

    it('Given an actively edited invalid displayName, When changed, Then save is blocked and status stays pending', () => {
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

    it('Given an invalid name from storage but another field edited, When changed, Then save still runs', async () => {
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
    it('Given save rejects, When the debounce elapses, Then status becomes error', async () => {
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
  });

  describe('SSR', () => {
    it('Given a non-browser platform, When a draft changes, Then no timer-driven save fires', () => {
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
