import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { profileFor } from './exercise-angle-profile';
import { POSE_DETECTOR_FACTORY, type PoseDetector } from './pose-detector.port';
import {
  POSE_FRAME_SOURCE,
  type PoseFrameSource,
} from './pose-frame-source.port';
import { poseToElbowSample } from './pose-to-sample';
import type { RepCounter, RepCounterStartOptions } from './rep-counter.port';
import { type RepCountSnapshot, RepStateMachine } from './rep-state-machine';

const INITIAL_SNAPSHOT: RepCountSnapshot = {
  count: 0,
  phase: 'awaiting-up',
  lastRepAtMs: null,
};

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

  private readonly _snapshot = signal<RepCountSnapshot>(INITIAL_SNAPSHOT);
  private readonly _isActive = signal(false);

  readonly snapshot = this._snapshot.asReadonly();
  readonly isActive = this._isActive.asReadonly();

  private machine: RepStateMachine | null = null;
  private detector: PoseDetector | null = null;
  private unsubscribeFrames: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;

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
    if (this._isActive()) return;

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

    this.machine = new RepStateMachine(profile);
    this._snapshot.set(this.machine.snapshot());

    this.detector = await this.detectorFactory();

    this.unsubscribeFrames = this.frameSource.subscribe(video, (tick) => {
      if (!this.detector || !this.machine) return;
      const result = this.detector.detectForVideo(video, tick.timestampMs);
      const sample = poseToElbowSample(result, tick.timestampMs);
      if (!sample) return;
      const out = this.machine.process(sample);
      this._snapshot.set(out.snapshot);
    });

    this._isActive.set(true);
  }

  async stop(): Promise<void> {
    this.unsubscribeFrames?.();
    this.unsubscribeFrames = null;
    this.detector?.close();
    this.detector = null;
    this._isActive.set(false);
  }

  reset(): void {
    this.machine?.reset();
    this._snapshot.set(this.machine?.snapshot() ?? INITIAL_SNAPSHOT);
  }
}
