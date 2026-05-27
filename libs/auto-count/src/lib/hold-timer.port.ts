import { InjectionToken, type Signal } from '@angular/core';
import type { HoldSnapshot } from './hold-state-machine';

export interface HoldTimerStartOptions {
  /** Hold catalog id, e.g. `'plank'`, `'hollowhold'`. */
  readonly exerciseId: string;
}

/**
 * Per-frame raw values surfaced for the Form-Check overlay during a
 * hold session.
 */
export interface HoldFormCheckFrame {
  readonly angleDeg: number;
  readonly confidence: number;
  readonly timestampMs: number;
}

/**
 * Port for any hold-timer implementation (pose camera, device motion,
 * test fake). Adapters live at the app level so this lib stays free of
 * browser-only or Firebase-y dependencies.
 */
export interface HoldTimer {
  readonly snapshot: Signal<HoldSnapshot>;
  readonly isActive: Signal<boolean>;
  readonly formCheckFrame: Signal<HoldFormCheckFrame | null>;
  bindVideoElement(el: HTMLVideoElement | null): void;
  start(options: HoldTimerStartOptions): Promise<void>;
  stop(): Promise<void>;
  reset(): void;
}

export const HOLD_TIMER = new InjectionToken<HoldTimer>('HOLD_TIMER');
