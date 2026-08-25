import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  firstOpenStepIndex,
  normalizeRestSec,
  normalizeSessionMode,
  type SessionMode,
} from '@pu-stats/models';

import { UserConfigStore } from '../../core/user-config.store';
import { TrainingPlanStore } from '../training-plan.store';
import { registerRestCountdown } from './session-rest.countdown';
import { sessionSelectors } from './training-session.selectors';

/**
 * Where the session currently stands.
 *
 * - `'intro'` — the day's exercises listed, rest duration adjustable.
 * - `'exercise'` — one step in focus with its capture tool.
 * - `'rest'` — counting down to the next step, which is already selected.
 * - `'done'` — nothing open left on the day.
 */
export type SessionPhase = 'intro' | 'exercise' | 'rest' | 'done';

interface TrainingSessionState {
  phase: SessionPhase;
  stepIndex: number;
  /**
   * Rest duration chosen inside this session, or `null` while the
   * session still follows the persisted config value. Kept separate so
   * a config doc that arrives after the page rendered doesn't overwrite
   * a duration the user just picked.
   */
  restOverride: number | null;
  restRemaining: number;
  /**
   * Ordering chosen inside this session, or `null` while the session
   * still follows the persisted config value — same late-arriving-config
   * guard as {@link TrainingSessionState.restOverride}.
   */
  modeOverride: SessionMode | null;
}

const INITIAL: TrainingSessionState = {
  phase: 'intro',
  stepIndex: 0,
  restOverride: null,
  restRemaining: 0,
  modeOverride: null,
};

/**
 * Drives one guided training session over the exercises of the active
 * plan day. Component-scoped: a session is page state, and leaving the
 * page ends it.
 *
 * The store owns no progress of its own — `steps` is derived from
 * `TrainingPlanStore.dayProgress()`, so a step closes exactly when the
 * entry it produced lands in the live mirror, and re-entering the page
 * mid-workout resumes where the logged entries say the user is.
 */
export const TrainingSessionStore = signalStore(
  withState(INITIAL),
  withProps(() => ({
    _plan: inject(TrainingPlanStore),
    _config: inject(UserConfigStore),
    _isBrowser: isPlatformBrowser(inject(PLATFORM_ID)),
  })),
  withComputed((store) =>
    sessionSelectors({
      plan: store._plan,
      config: store._config,
      stepIndex: store.stepIndex,
      restOverride: store.restOverride,
      modeOverride: store.modeOverride,
    })
  ),
  withMethods((store) => {
    /**
     * Freeze the ordering the session is about to walk. A config doc that
     * resolves after the workout started would otherwise flip `mode()`
     * and re-order `steps()` under a `stepIndex` that means something
     * different per mode, dropping the user onto an unrelated step.
     */
    function pinMode(): void {
      if (store.modeOverride() === null) {
        patchState(store, { modeOverride: store.mode() });
      }
    }

    /**
     * Move to the first open step at or after `from`, entering rest
     * first when one is configured and there is somewhere to rest for.
     * Finishing the last step ends the session rather than resting.
     */
    function advanceFrom(from: number, withRest: boolean): void {
      const next = firstOpenStepIndex(store.steps(), from);
      if (next === -1) {
        patchState(store, { phase: 'done', restRemaining: 0 });
        return;
      }
      const rest = store.restSec();
      patchState(store, {
        stepIndex: next,
        phase: withRest && rest > 0 ? 'rest' : 'exercise',
        restRemaining: withRest && rest > 0 ? rest : 0,
      });
    }

    return {
      /** Start the session on the first exercise that still needs work. */
      begin(): void {
        pinMode();
        advanceFrom(0, false);
      },

      /**
       * A step closed. Rest, then take the next open one — the current
       * index is skipped even if the live mirror hasn't echoed the write
       * yet, so the session never re-offers the exercise just finished.
       */
      completeStep(): void {
        advanceFrom(store.stepIndex() + 1, true);
      },

      /** Leave a step untouched and move on. No rest — nothing was done. */
      skipStep(): void {
        advanceFrom(store.stepIndex() + 1, false);
      },

      /** Jump straight to a step from the overview or the summary. */
      goToStep(index: number): void {
        pinMode();
        if (index < 0 || index >= store.steps().length) return;
        patchState(store, {
          stepIndex: index,
          phase: 'exercise',
          restRemaining: 0,
        });
      },

      /** Cut the countdown short and start the next exercise now. */
      endRest(): void {
        if (store.phase() !== 'rest') return;
        patchState(store, { phase: 'exercise', restRemaining: 0 });
      },

      /** Stretch or shorten the running countdown by `delta` seconds. */
      nudgeRest(delta: number): void {
        if (store.phase() !== 'rest') return;
        patchState(store, {
          restRemaining: Math.max(0, store.restRemaining() + delta),
        });
      },

      /** Tick one second off the countdown; ends the rest at zero. */
      tickRest(): void {
        if (store.phase() !== 'rest') return;
        const next = store.restRemaining() - 1;
        if (next <= 0) {
          patchState(store, { phase: 'exercise', restRemaining: 0 });
          return;
        }
        patchState(store, { restRemaining: next });
      },

      /**
       * Pick the rest duration for this and every later session. The
       * persist is fire-and-forget: a failed config write must not stop
       * a workout that is already using the new value locally.
       */
      setRestSec(seconds: number): void {
        const rest = normalizeRestSec(seconds);
        patchState(store, { restOverride: rest });
        void store._config.saveSessionRestSec(rest).catch(() => undefined);
      },

      /**
       * Switch between working through one exercise at a time and a
       * circuit. Re-orders the step list wholesale, so the position is
       * reset — a step index means something different per mode.
       */
      setMode(mode: SessionMode): void {
        const next = normalizeSessionMode(mode);
        if (next === store.mode()) return;
        patchState(store, {
          modeOverride: next,
          stepIndex: 0,
          restRemaining: 0,
        });
        void store._config.saveSessionMode(next).catch(() => undefined);
      },

      /** Back to the overview, e.g. to change the rest duration. */
      backToIntro(): void {
        patchState(store, { phase: 'intro', restRemaining: 0 });
      },
    };
  }),
  withHooks({
    onInit: (store) => registerRestCountdown(store),
  })
);

export type TrainingSessionStoreType = InstanceType<
  typeof TrainingSessionStore
>;
