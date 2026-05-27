import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import {
  type ExerciseHoldProfile,
  holdProfileFor,
} from './exercise-hold-profile';
import { HoldStateMachine, type HoldSnapshot } from './hold-state-machine';
import {
  type HoldFormCheckFrame,
  type HoldTimer,
  type HoldTimerStartOptions,
} from './hold-timer.port';
import { POSE_DETECTOR_FACTORY, type PoseDetector } from './pose-detector.port';
import {
  POSE_FRAME_SOURCE,
  type PoseFrameSource,
} from './pose-frame-source.port';
import { poseToAngleSample } from './pose-to-sample';

const INITIAL_SNAPSHOT: HoldSnapshot = {
  totalMs: 0,
  phase: 'idle',
  segmentStartMs: null,
};

const snapshotEqual = (a: HoldSnapshot, b: HoldSnapshot): boolean =>
  a.totalMs === b.totalMs &&
  a.phase === b.phase &&
  a.segmentStartMs === b.segmentStartMs;

/**
 * Pose-based isometric hold timer. Implements {@link HoldTimer} port.
 * Browser-only; on the server it stays idle so SSR doesn't try to load
 * MediaPipe/camera code.
 *
 * The service is not `providedIn: 'root'`: callers wire it through the
 * concrete adapter providers (POSE_DETECTOR_FACTORY, POSE_FRAME_SOURCE)
 * at the app config level. Tests substitute in DI fakes.
 */
@Injectable()
export class PoseHoldTimerService implements HoldTimer {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly detectorFactory = inject(POSE_DETECTOR_FACTORY);
  private readonly frameSource = inject<PoseFrameSource>(POSE_FRAME_SOURCE);

  private readonly _snapshot = signal<HoldSnapshot>(INITIAL_SNAPSHOT, {
    equal: snapshotEqual,
  });
  private readonly _isActive = signal(false);
  private readonly _formCheckFrame = signal<HoldFormCheckFrame | null>(null);

  readonly snapshot = this._snapshot.asReadonly();
  readonly isActive = this._isActive.asReadonly();
  readonly formCheckFrame = this._formCheckFrame.asReadonly();

  private machine: HoldStateMachine | null = null;
  private detector: PoseDetector | null = null;
  private unsubscribeFrames: (() => void) | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private startPending = false;
  private startToken = 0;
  private activeProfile: ExerciseHoldProfile | null = null;

  bindVideoElement(el: HTMLVideoElement | null): void {
    this.videoEl = el;
  }

  async start(options: HoldTimerStartOptions): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this._isActive() || this.startPending) return;

    const profile = holdProfileFor(options.exerciseId);
    if (!profile) {
      throw new Error(
        `PoseHoldTimerService: no hold profile for exercise "${options.exerciseId}"`
      );
    }

    const video = this.videoEl;
    if (!video) {
      throw new Error(
        'PoseHoldTimerService: bindVideoElement must be called before start'
      );
    }

    this.startPending = true;
    const token = ++this.startToken;

    this.machine = new HoldStateMachine(profile);
    this.activeProfile = profile;
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
      if (!this.detector || !this.machine || !this.activeProfile) return;
      const result = this.detector.detectForVideo(video, tick.timestampMs);
      const sample = poseToAngleSample(
        result,
        this.activeProfile,
        tick.timestampMs
      );
      if (!sample) {
        this._formCheckFrame.set(null);
        return;
      }
      this._formCheckFrame.set({
        angleDeg: sample.angleDeg,
        confidence: sample.confidence,
        timestampMs: sample.timestampMs,
      });
      const next = this.machine.process(sample);
      this._snapshot.set(next);
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
    this.activeProfile = null;
    this._isActive.set(false);
    this._formCheckFrame.set(null);
  }

  reset(): void {
    this.machine?.reset();
    this._snapshot.set(this.machine?.snapshot() ?? INITIAL_SNAPSHOT);
    this._formCheckFrame.set(null);
  }
}
