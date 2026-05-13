import { InjectionToken, type Signal } from '@angular/core';
import type { RepCountSnapshot } from './rep-state-machine';

export interface RepCounterStartOptions {
  /** Exercise catalog id; selects the active `ExerciseAngleProfile`. */
  readonly exerciseId: string;
}

/**
 * Port for any rep-counting implementation (pose camera, device motion,
 * test fake). Adapters live at the app level so this lib stays free of
 * browser-only or Firebase-y dependencies.
 */
export interface RepCounter {
  readonly snapshot: Signal<RepCountSnapshot>;
  readonly isActive: Signal<boolean>;
  start(options: RepCounterStartOptions): Promise<void>;
  stop(): Promise<void>;
  reset(): void;
}

export const REP_COUNTER = new InjectionToken<RepCounter>('REP_COUNTER');
