import { TestBed } from '@angular/core/testing';
import { ReminderFormStore } from './reminder-form.store';
import type { ReminderConfig } from '@pu-stats/models';

const defaultConfig: ReminderConfig = {
  enabled: false,
  intervalMinutes: 60,
  quietHours: [],
  timezone: 'Europe/Berlin',
  language: 'de',
};

describe('ReminderFormStore', () => {
  let store: InstanceType<typeof ReminderFormStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReminderFormStore],
    });
    store = TestBed.inject(ReminderFormStore);
  });

  it('should initialize with enabled=false', () => {
    expect(store.enabled()).toBe(false);
    expect(store.dirty()).toBe(false);
  });

  it('should sync from config', () => {
    const config: ReminderConfig = {
      ...defaultConfig,
      enabled: true,
      intervalMinutes: 30,
      quietHours: [{ from: '22:00', to: '06:00' }],
      language: 'en',
    };
    store.syncFromConfig(config);
    expect(store.enabled()).toBe(true);
    expect(store.intervalMinutes()).toBe(30);
    expect(store.language()).toBe('en');
    expect(store.quietHours()).toEqual([{ from: '22:00', to: '06:00' }]);
    expect(store.dirty()).toBe(false);
  });

  it('should sync from null config with defaults', () => {
    store.syncFromConfig(null);
    expect(store.enabled()).toBe(false);
    expect(store.intervalMinutes()).toBe(60);
    expect(store.language()).toBe('de');
    expect(store.quietHours()).toEqual([]);
    expect(store.dirty()).toBe(false);
  });

  it('should mark dirty when user changes enabled', () => {
    store.setEnabled(true);
    expect(store.enabled()).toBe(true);
    expect(store.dirty()).toBe(true);
  });

  it('should reset dirty on syncFromConfig', () => {
    store.setEnabled(true);
    expect(store.dirty()).toBe(true);
    store.syncFromConfig(null);
    expect(store.dirty()).toBe(false);
  });

  describe('syncIfClean (race condition guard)', () => {
    it('syncs when form is clean', () => {
      const config: ReminderConfig = { ...defaultConfig, enabled: true };
      store.syncIfClean(config);
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(false);
    });

    it('skips sync when form is dirty (user has unsaved edits)', () => {
      // User enables reminders
      store.setEnabled(true);
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(true);

      // Async config load arrives with enabled=false — should be ignored
      store.syncIfClean({ ...defaultConfig, enabled: false });

      // User's edit is preserved
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(true);
    });

    it('syncs again after user saves (dirty resets)', () => {
      store.setEnabled(true);
      expect(store.dirty()).toBe(true);

      // Simulate save completing → syncFromConfig resets dirty
      store.syncFromConfig({ ...defaultConfig, enabled: true });
      expect(store.dirty()).toBe(false);

      // Now a new config load should sync
      store.syncIfClean({ ...defaultConfig, enabled: false });
      expect(store.enabled()).toBe(false);
    });
  });
});
