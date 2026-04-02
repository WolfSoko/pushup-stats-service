import { computed, effect, Injectable } from '@angular/core';
import { signalState, patchState } from '@ngrx/signals';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme-mode';

interface ThemeState {
  mode: ThemeMode;
  systemPreference: ResolvedTheme;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly state = signalState<ThemeState>({
    mode: this.loadStoredMode(),
    systemPreference: this.getSystemPreference(),
  });

  /** Current mode setting: 'auto', 'light', or 'dark' */
  readonly currentMode = computed(() => this.state.mode());

  /** Resolved theme based on mode and system preference */
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const mode = this.state.mode();
    if (mode === 'auto') {
      return this.state.systemPreference();
    }
    return mode;
  });

  constructor() {
    // Listen for system preference changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        patchState(this.state, {
          systemPreference: e.matches ? 'dark' : 'light',
        });
      });
    }

    // Apply theme class whenever resolved theme changes
    effect(() => {
      this.applyThemeClass(this.state.mode(), this.resolvedTheme());
    });
  }

  /** Set the theme mode and persist to localStorage */
  setMode(mode: ThemeMode): void {
    patchState(this.state, { mode });
    this.persistMode(mode);
  }

  /** Cycle through modes: auto -> light -> dark -> auto */
  cycleMode(): void {
    const current = this.state.mode();
    const next: ThemeMode =
      current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    this.setMode(next);
  }

  private loadStoredMode(): ThemeMode {
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

  private persistMode(mode: ThemeMode): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // ignore persistence errors (e.g. storage disabled or quota exceeded)
      }
    }
  }

  private getSystemPreference(): ResolvedTheme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'dark';
  }

  private applyThemeClass(mode: ThemeMode, resolved: ResolvedTheme): void {
    if (typeof document === 'undefined') {
      return;
    }
    const html = document.documentElement;

    // Remove existing theme classes
    html.classList.remove('light-theme', 'dark-theme');

    // When mode is 'auto', don't add any class - let CSS media queries handle it
    // When mode is explicit, add the corresponding class
    if (mode !== 'auto') {
      html.classList.add(`${resolved}-theme`);
    }
  }
}
