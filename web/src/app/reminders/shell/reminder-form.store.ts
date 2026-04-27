import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import {
  type ReminderConfig,
  QUICK_LOG_REPS_MAX,
  QUICK_LOG_REPS_MIN,
} from '@pu-stats/models';

type ReminderFormState = {
  enabled: boolean;
  intervalMinutes: number;
  language: 'de' | 'en';
  quietHours: { from: string; to: string }[];
  /**
   * Whether the one-tap quick-log notification action is enabled. Tracked as
   * a separate flag so the count can be edited while the toggle is off
   * without losing the value.
   */
  quickLogEnabled: boolean;
  quickLogReps: number;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
};

const DEFAULT_QUICK_LOG_REPS = 10;

const initialState: ReminderFormState = {
  enabled: false,
  intervalMinutes: 60,
  language: 'de',
  quietHours: [],
  quickLogEnabled: false,
  quickLogReps: DEFAULT_QUICK_LOG_REPS,
  dirty: false,
  saving: false,
  saved: false,
};

/**
 * Local (component-provided) store for the reminder settings form.
 * Manages draft state independently from the global ReminderStore.
 */
export const ReminderFormStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    canSave: computed(() => store.dirty() && !store.saving()),
  })),
  withMethods((store) => ({
    syncFromConfig(config: ReminderConfig | null): void {
      // Clamp to both bounds on hydrate so a Firestore value written by an
      // older client (or via an admin tool) can't leak an out-of-range count
      // into the form (CodeRabbit/Copilot, PR #249).
      const savedReps = config?.quickLogReps;
      const normalizedReps =
        typeof savedReps === 'number' && Number.isFinite(savedReps)
          ? Math.floor(savedReps)
          : undefined;
      const repsValid =
        normalizedReps !== undefined && normalizedReps >= QUICK_LOG_REPS_MIN;
      patchState(store, {
        enabled: config?.enabled ?? false,
        intervalMinutes: config?.intervalMinutes ?? 60,
        language: config?.language ?? 'de',
        quietHours: config?.quietHours ? [...config.quietHours] : [],
        quickLogEnabled: repsValid,
        quickLogReps: repsValid
          ? Math.min(normalizedReps as number, QUICK_LOG_REPS_MAX)
          : DEFAULT_QUICK_LOG_REPS,
        dirty: false,
        saved: false,
      });
    },

    /** Sync from config only when the user has no unsaved edits. */
    syncIfClean(config: ReminderConfig | null): void {
      if (!store.dirty()) {
        this.syncFromConfig(config);
      }
    },

    setEnabled(value: boolean): void {
      patchState(store, { enabled: value, dirty: true });
    },

    setInterval(value: number): void {
      patchState(store, { intervalMinutes: value, dirty: true });
    },

    setLanguage(value: 'de' | 'en'): void {
      patchState(store, { language: value, dirty: true });
    },

    addQuietHour(): void {
      patchState(store, {
        quietHours: [...store.quietHours(), { from: '22:00', to: '07:00' }],
        dirty: true,
      });
    },

    removeQuietHour(index: number): void {
      patchState(store, {
        quietHours: store.quietHours().filter((_, i) => i !== index),
        dirty: true,
      });
    },

    updateQuietHour(index: number, field: 'from' | 'to', value: string): void {
      const copy = [...store.quietHours()];
      copy[index] = { ...copy[index], [field]: value };
      patchState(store, { quietHours: copy, dirty: true });
    },

    clampInterval(): void {
      const val = store.intervalMinutes();
      const clamped = Number.isNaN(val) ? 60 : Math.min(480, Math.max(15, val));
      patchState(store, { intervalMinutes: clamped });
    },

    setQuickLogEnabled(value: boolean): void {
      patchState(store, { quickLogEnabled: value, dirty: true });
    },

    setQuickLogReps(value: number): void {
      patchState(store, { quickLogReps: value, dirty: true });
    },

    clampQuickLogReps(): void {
      const val = store.quickLogReps();
      const clamped = Number.isFinite(val)
        ? Math.min(QUICK_LOG_REPS_MAX, Math.max(QUICK_LOG_REPS_MIN, val))
        : DEFAULT_QUICK_LOG_REPS;
      patchState(store, { quickLogReps: Math.floor(clamped) });
    },

    setSaving(value: boolean): void {
      patchState(store, { saving: value });
    },

    markSaved(): void {
      patchState(store, { dirty: false, saved: true, saving: false });
    },

    clearSaved(): void {
      patchState(store, { saved: false });
    },

    toConfig(timezone: string): ReminderConfig {
      const config: ReminderConfig = {
        enabled: store.enabled(),
        intervalMinutes: store.intervalMinutes(),
        quietHours: store.quietHours(),
        timezone,
        language: store.language(),
      };
      if (store.quickLogEnabled()) {
        const reps = Math.floor(store.quickLogReps());
        if (Number.isFinite(reps) && reps >= QUICK_LOG_REPS_MIN) {
          config.quickLogReps = Math.min(reps, QUICK_LOG_REPS_MAX);
        }
      }
      return config;
    },
  }))
);
