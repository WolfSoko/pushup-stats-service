import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

/**
 * Where a workout session stands: when it started, and which exercises
 * were ticked off by hand. Everything else about progress comes from the
 * logged entries, exactly as for a plan day.
 */
export interface WorkoutRunState {
  /** Local ISO timestamp with offset; entries before it don't count. */
  readonly startedAt: string;
  /** Item indexes closed without an entry. */
  readonly checked: ReadonlyArray<number>;
}

const KEY_PREFIX = 'pu.workout-run.';

/** The run's local calendar date (`YYYY-MM-DD`), off the offset timestamp. */
export function runDate(run: WorkoutRunState): string {
  return run.startedAt.slice(0, 10);
}

/**
 * A run that started on another day is history, not something to
 * resume — its entries belong to that day and would never close it.
 */
export function isRunFromToday(
  run: WorkoutRunState | null,
  todayIso: string
): run is WorkoutRunState {
  return run !== null && runDate(run) === todayIso;
}

export function parseRunState(raw: string | null): WorkoutRunState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { startedAt?: unknown; checked?: unknown };
    if (typeof value.startedAt !== 'string' || value.startedAt.length < 10) {
      return null;
    }
    const checked = Array.isArray(value.checked)
      ? value.checked.filter(
          (i): i is number => Number.isInteger(i) && (i as number) >= 0
        )
      : [];
    return { startedAt: value.startedAt, checked };
  } catch {
    return null;
  }
}

/**
 * Persists a run per workout so leaving the page mid-workout and coming
 * back resumes it — the plan session gets that from its Firestore
 * document; a workout has none, so `localStorage` stands in. Best
 * effort: without storage the run simply lives as long as the page.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutRunStateService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  load(workoutId: string): WorkoutRunState | null {
    if (!this.isBrowser) return null;
    try {
      return parseRunState(localStorage.getItem(KEY_PREFIX + workoutId));
    } catch {
      return null;
    }
  }

  save(workoutId: string, run: WorkoutRunState): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(KEY_PREFIX + workoutId, JSON.stringify(run));
    } catch {
      // Storage full or blocked — the run still lives in the store.
    }
  }

  clear(workoutId: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(KEY_PREFIX + workoutId);
    } catch {
      // Nothing to clear without storage.
    }
  }
}
