import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { profileFor } from './exercise-angle-profile';
import { POSE_DETECTOR_FACTORY, type PoseDetector } from './pose-detector.port';
import {
  POSE_FRAME_SOURCE,
  type PoseFrameSource,
} from './pose-frame-source.port';
import { poseToAngleSample } from './pose-to-sample';
import type { RepCounter, RepCounterStartOptions } from './rep-counter.port';
import { type RepCountSnapshot, RepStateMachine } from './rep-state-machine';

const INITIAL_SNAPSHOT: RepCountSnapshot = {
  count: 0,
  phase: 'awaiting-up',
  lastRepAtMs: null,
};

const snapshotEqual = (a: RepCountSnapshot, b: RepCountSnapshot): boolean =>
  a.count === b.count && a.phase === b.phase && a.lastRepAtMs === b.lastRepAtMs;

/**
 * Per-frame raw values surfaced for the Form-Check overlay. Updates on
 * every accepted frame (regardless of state-machine phase change), so
 * downstream consumers see live angle and confidence ticks at camera
 * rate. Separate from `snapshot` because `snapshot` uses value-equality
 * to keep stat displays from re-rendering 60×/s — we explicitly DO
 * want that high frequency here.
 */
export interface FormCheckFrame {
  readonly angleDeg: number;
  readonly confidence: number;
  readonly timestampMs: number;
}

/**
 * Pose-based rep counter. Browser-only — on the server it stays in
 * `isActive=false` and `start()` resolves immediately as a no-op so SSR
 * prerender doesn't pull MediaPipe/camera code into the server bundle.
 *
 * The service is not `providedIn: 'root'`: callers wire it through the
 * concrete adapter providers (POSE_DETECTOR_FACTORY, POSE_FRAME_SOURCE)
 * at the app config level. Tests substitute in DI fakes.
 */
@Injectable()
export class PoseRepCounterService implements RepCounter {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly detectorFactory = inject(POSE_DETECTOR_FACTORY);
  private readonly frameSource = inject<PoseFrameSource>(POSE_FRAME_SOURCE);

  private readonly _snapshot = signal<RepCountSnapshot>(INITIAL_SNAPSHOT, {
    equal: snapshotEqual,
  });
  private readonly _isActive = signal(false);
  private readonly _formCheckFrame = signal<FormCheckFrame | null>(null);

  readonly snapshot = this._snapshot.asReadonly();
  readonly isActive = this._isActive.asReadonly();
  /**
   * Live per-frame angle + confidence + timestamp. Powers the
   * Form-Check overlay so users can sanity-check that the detector is
   * tracking the right joint with sufficient confidence.
   */
  readonly formCheckFrame = this._formCheckFrame.asReadonly();

  private machine: RepStateMachine | null = null;
  private detector: PoseDetector | null = null;
  private unsubscribeFrames: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private startPending = false;
  /**
   * Bumped on every `start()` and `stop()` so an in-flight start that
   * was cancelled (by a concurrent stop, or a follow-up start) can
   * detect the abort when it resumes after the detector factory awaits.
   */
  private startToken = 0;

  /**
   * Component-driven: the dialog wires its own `<video>` and hands the
   * element here before `start()`. Keeps the service free of DOM
   * lookup and lets the component own the camera permission UI.
   */
  bindVideoElement(el: HTMLVideoElement | null): void {
    this.videoEl = el;
  }

  async start(options: RepCounterStartOptions): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this._isActive() || this.startPending) return;

    const profile = profileFor(options.exerciseId);
    if (!profile) {
      throw new Error(
        `PoseRepCounterService: no profile for exercise "${options.exerciseId}"`
      );
    }

    const video = this.videoEl;
    if (!video) {
      throw new Error(
        'PoseRepCounterService: bindVideoElement must be called before start'
      );
    }

    this.startPending = true;
    const token = ++this.startToken;

    this.machine = new RepStateMachine(profile);
    this._snapshot.set(this.machine.snapshot());

    let detector: PoseDetector;
    try {
      detector = await this.detectorFactory();
    } catch (err) {
      if (token === this.startToken) this.startPending = false;
      throw err;
    }

    if (token !== this.startToken) {
      detector.close();
      return;
    }

    this.detector = detector;
    this.unsubscribeFrames = this.frameSource.subscribe(video, (tick) => {
      if (!this.detector || !this.machine) return;
      const result = this.detector.detectForVideo(video, tick.timestampMs);
      const sample = poseToAngleSample(result, profile, tick.timestampMs);
      if (!sample) {
        // Tracking lost (user moved out of frame, landmarks unreadable):
        // clear the overlay so the user sees an honest "—" instead of
        // a stale angle/confidence pair frozen from the last good frame.
        this._formCheckFrame.set(null);
        return;
      }
      this._formCheckFrame.set({
        angleDeg: sample.angleDeg,
        confidence: sample.confidence,
        timestampMs: sample.timestampMs,
      });
      const out = this.machine.process(sample);
      this._snapshot.set(out.snapshot);
    });

    this._isActive.set(true);
    this.startPending = false;
  }

  async stop(): Promise<void> {
    this.startToken += 1;
    this.startPending = false;
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = null;
    this.detector?.close();
    this.detector = null;
    this._isActive.set(false);
    this._formCheckFrame.set(null);
  }

  reset(): void {
    this.machine?.reset();
    this._snapshot.set(this.machine?.snapshot() ?? INITIAL_SNAPSHOT);
    this._formCheckFrame.set(null);
  }
}
