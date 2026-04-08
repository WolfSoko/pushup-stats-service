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
  function createStore() {
    return TestBed.runInInjectionContext(() => new ReminderFormStore());
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should initialize with enabled=false', () => {
    const store = createStore();
    expect(store.enabled()).toBe(false);
    expect(store.dirty()).toBe(false);
  });

  it('should sync from config', () => {
    const store = createStore();
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
    const store = createStore();
    store.syncFromConfig(null);
    expect(store.enabled()).toBe(false);
    expect(store.intervalMinutes()).toBe(60);
    expect(store.language()).toBe('de');
    expect(store.quietHours()).toEqual([]);
  });

  it('should mark dirty when user changes enabled', () => {
    const store = createStore();
    store.setEnabled(true);
    expect(store.enabled()).toBe(true);
    expect(store.dirty()).toBe(true);
  });

  it('should reset dirty on syncFromConfig', () => {
    const store = createStore();
    store.setEnabled(true);
    expect(store.dirty()).toBe(true);
    store.syncFromConfig(null);
    expect(store.dirty()).toBe(false);
  });

  describe('race condition: config load vs user edit', () => {
    it('syncFromConfig overwrites user edits when called directly (the bug scenario)', () => {
      const store = createStore();
      // User enables reminders
      store.setEnabled(true);
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(true);

      // Async config load arrives with enabled=false — overwrites!
      store.syncFromConfig({ ...defaultConfig, enabled: false });
      expect(store.enabled()).toBe(false);
      expect(store.dirty()).toBe(false);
    });

    it('dirty guard prevents overwrite of user edits', () => {
      const store = createStore();
      // User enables reminders
      store.setEnabled(true);
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(true);

      // Guard: only sync when not dirty (matches the component effect fix)
      if (!store.dirty()) {
        store.syncFromConfig({ ...defaultConfig, enabled: false });
      }
      // User's edit is preserved
      expect(store.enabled()).toBe(true);
      expect(store.dirty()).toBe(true);
    });
  });
});
