import { InjectionToken, type Signal } from '@angular/core';
import type { RepCountSnapshot } from './rep-state-machine';

export interface RepCounterStartOptions {
  /** Exercise catalog id; selects the active `ExerciseAngleProfile`. */
  readonly exerciseId: string;
}

/**
 * Per-frame raw values surfaced for the Form-Check overlay.
 */
export interface FormCheckFrame {
  readonly angleDeg: number;
  readonly confidence: number;
  readonly timestampMs: number;
}

/**
 * Port for any rep-counting implementation (pose camera, device motion,
 * test fake). Adapters live at the app level so this lib stays free of
 * browser-only or Firebase-y dependencies.
 */
export interface RepCounter {
  readonly snapshot: Signal<RepCountSnapshot>;
  readonly isActive: Signal<boolean>;
  readonly formCheckFrame: Signal<FormCheckFrame | null>;
  bindVideoElement(el: HTMLVideoElement | null): void;
  start(options: RepCounterStartOptions): Promise<void>;
  stop(): Promise<void>;
  reset(): void;
}

export const REP_COUNTER = new InjectionToken<RepCounter>('REP_COUNTER');
