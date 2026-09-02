import { isPlatformBrowser } from '@angular/common';
import {
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import { BrightnessEnvelope } from './brightness-envelope';
import { FRAME_LUMA_SAMPLER } from './frame-luma-sampler.port';
import {
  POSE_FRAME_SOURCE,
  type PoseFrameSource,
} from './pose-frame-source.port';
import {
  type FormCheckFrame,
  type RepCounter,
  type RepCounterStartOptions,
} from './rep-counter.port';
import {
  type RepCountSnapshot,
  RepStateMachine,
  type RepThresholds,
} from './rep-state-machine';

/**
 * Rep thresholds for the brightness signal, expressed on the same
 * 0–180° scale the pose detector uses so {@link RepStateMachine} serves
 * both: 180° = brightest (body far, "up"), 0° = darkest (body on top of
 * the camera, "down").
 */
export const PROXIMITY_THRESHOLDS: RepThresholds = {
  upAngleDeg: 120,
  downAngleDeg: 60,
  minDwellMs: 150,
  minConfidence: 0.5,
  maxFrameGapMs: 500,
};

/** Degrees the brightness position maps onto (`position 0` → 180°). */
export const PROXIMITY_ANGLE_SPAN_DEG = 180;

const INITIAL_SNAPSHOT: RepCountSnapshot = {
  count: 0,
  phase: 'awaiting-up',
  lastRepAtMs: null,
};

/**
 * Second {@link RepCounter} implementation: counts reps from the
 * brightness swing a body produces above a camera lying beneath it —
 * pushups over a phone on the floor, dips over a phone on the bench.
 * Exercise-agnostic (no pose profile), so it needs no MediaPipe and
 * works wherever the pose detector cannot see the joints.
 */
export const PROXIMITY_REP_COUNTER = new InjectionToken<RepCounter>(
  'PROXIMITY_REP_COUNTER'
);

@Injectable()
export class ProximityRepCounterService implements RepCounter {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly frameSource = inject<PoseFrameSource>(POSE_FRAME_SOURCE);
  private readonly sampler = inject(FRAME_LUMA_SAMPLER);

  private readonly _snapshot = signal<RepCountSnapshot>(INITIAL_SNAPSHOT);
  private readonly _isActive = signal(false);
  private readonly _formCheckFrame = signal<FormCheckFrame | null>(null);

  readonly snapshot = this._snapshot.asReadonly();
  readonly isActive = this._isActive.asReadonly();
  /** `angleDeg` carries the near/far position on the 0–180° scale. */
  readonly formCheckFrame = this._formCheckFrame.asReadonly();

  private readonly machine = new RepStateMachine(PROXIMITY_THRESHOLDS);
  private readonly envelope = new BrightnessEnvelope();
  private unsubscribeFrames: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;

  bindVideoElement(el: HTMLVideoElement | null): void {
    this.videoEl = el;
  }

  // The exercise id only rides along for the caller's result; the
  // brightness swing looks the same for every rep exercise.
  async start(_options: RepCounterStartOptions): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this._isActive()) return;
    const video = this.videoEl;
    if (!video) {
      throw new Error(
        'ProximityRepCounterService: bindVideoElement must be called before start'
      );
    }
    this.unsubscribeFrames = this.frameSource.subscribe(video, (tick) => {
      const luma = this.sampler.sample(video);
      if (luma === null) {
        this._formCheckFrame.set(null);
        return;
      }
      const { position, confidence } = this.envelope.push(
        luma,
        tick.timestampMs
      );
      const angleDeg = (1 - position) * PROXIMITY_ANGLE_SPAN_DEG;
      this._formCheckFrame.set({
        angleDeg,
        confidence,
        timestampMs: tick.timestampMs,
      });
      const out = this.machine.process({
        angleDeg,
        confidence,
        timestampMs: tick.timestampMs,
      });
      this._snapshot.set(out.snapshot);
    });
    this._isActive.set(true);
  }

  async stop(): Promise<void> {
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = null;
    this._isActive.set(false);
    this._formCheckFrame.set(null);
  }

  reset(): void {
    this.machine.reset();
    this.envelope.reset();
    this._snapshot.set(this.machine.snapshot());
    this._formCheckFrame.set(null);
  }
}
