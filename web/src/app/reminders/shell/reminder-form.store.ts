import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import type { ReminderConfig } from '@pu-stats/models';

type ReminderFormState = {
  enabled: boolean;
  intervalMinutes: number;
  language: 'de' | 'en';
  quietHours: { from: string; to: string }[];
  dirty: boolean;
  saving: boolean;
  saved: boolean;
};

const initialState: ReminderFormState = {
  enabled: false,
  intervalMinutes: 60,
  language: 'de',
  quietHours: [],
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
      patchState(store, {
        enabled: config?.enabled ?? false,
        intervalMinutes: config?.intervalMinutes ?? 60,
        language: config?.language ?? 'de',
        quietHours: config?.quietHours ? [...config.quietHours] : [],
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
      return {
        enabled: store.enabled(),
        intervalMinutes: store.intervalMinutes(),
        quietHours: store.quietHours(),
        timezone,
        language: store.language(),
      };
    },
  }))
);
