import { InjectionToken } from '@angular/core';

export interface FrameTick {
  /** Monotonic timestamp in ms (e.g. `performance.now()`). */
  readonly timestampMs: number;
}

/**
 * Drives the detection loop. Concrete adapter uses
 * `requestVideoFrameCallback` where available, falling back to
 * `requestAnimationFrame` on Safari versions that haven't shipped it.
 * Abstracted so tests can emit frames synchronously and deterministically.
 */
export interface PoseFrameSource {
  subscribe(
    video: HTMLVideoElement,
    onTick: (tick: FrameTick) => void
  ): () => void;
}

export const POSE_FRAME_SOURCE = new InjectionToken<PoseFrameSource>(
  'POSE_FRAME_SOURCE'
);
