import { computed, effect } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-mode';

interface ThemeState {
  mode: ThemeMode;
  systemPreference: ResolvedTheme;
}

function loadStoredMode(): ThemeMode {
  if (typeof localStorage === 'undefined') {
    return 'auto';
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  } catch {
    return 'auto';
  }
  return 'auto';
}

function getSystemPreference(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'dark';
}

function persistMode(mode: ThemeMode): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore persistence errors (e.g. storage disabled or quota exceeded)
    }
  }
}

function applyThemeClass(_mode: ThemeMode, resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const html = document.documentElement;

  // Remove existing theme classes
  html.classList.remove('light-theme', 'dark-theme');

  // Always apply resolved theme class (ThemeService handles prefers-color-scheme via JS)
  html.classList.add(`${resolved}-theme`);
}

const initialState: ThemeState = {
  mode: loadStoredMode(),
  systemPreference: getSystemPreference(),
};

export const ThemeService = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    /** Current mode setting: 'auto', 'light', or 'dark' */
    currentMode: computed(() => store.mode()),
    /** Resolved theme based on mode and system preference */
    resolvedTheme: computed<ResolvedTheme>(() => {
      const mode = store.mode();
      if (mode === 'auto') {
        return store.systemPreference();
      }
      return mode;
    }),
  })),
  withMethods((store) => ({
    /** Set the theme mode and persist to localStorage */
    setMode(mode: ThemeMode): void {
      patchState(store, { mode });
      persistMode(mode);
    },
    /** Cycle through modes: auto -> light -> dark -> auto */
    cycleMode(): void {
      const current = store.mode();
      const next: ThemeMode =
        current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
      patchState(store, { mode: next });
      persistMode(next);
    },
    /** Update system preference (called by media query listener) */
    _updateSystemPreference(preference: ResolvedTheme): void {
      patchState(store, { systemPreference: preference });
    },
  })),
  withHooks({
    onInit(store) {
      // Listen for system preference changes
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
          store._updateSystemPreference(e.matches ? 'dark' : 'light');
        });
      }

      // Apply theme class whenever resolved theme changes
      effect(() => {
        applyThemeClass(store.mode(), store.resolvedTheme());
      });
    },
  })
);
