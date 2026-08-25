import { DestroyRef, effect, inject, untracked } from '@angular/core';

/** The slice of the session store the countdown drives. */
export interface RestCountdownHost {
  phase: () => string;
  tickRest: () => void;
  _isBrowser: boolean;
}

/** One countdown tick. Whole seconds — the UI renders `m:ss`. */
const REST_TICK_MS = 1000;

/**
 * Runs the rest countdown while the session is in its `rest` phase.
 *
 * The interval is started and stopped by an effect on the phase rather
 * than left running for the session's lifetime: a timer ticking through
 * the exercise phase would keep the zone busy for the whole workout, and
 * an interval that outlives the page leaks across `TestBed` resets.
 */
export function registerRestCountdown(store: RestCountdownHost): void {
  if (!store._isBrowser) return;
  const destroyRef = inject(DestroyRef);
  let handle: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    if (handle === null) return;
    clearInterval(handle);
    handle = null;
  };

  effect(() => {
    const resting = store.phase() === 'rest';
    untracked(() => {
      if (!resting) {
        stop();
        return;
      }
      if (handle !== null) return;
      handle = setInterval(() => store.tickRest(), REST_TICK_MS);
    });
  });

  destroyRef.onDestroy(stop);
}
