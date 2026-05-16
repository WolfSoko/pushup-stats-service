import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  POSE_DETECTOR_FACTORY,
  POSE_LANDMARK,
  type PoseDetectionResult,
  type PoseDetector,
  type PoseLandmark,
} from './pose-detector.port';
import {
  POSE_FRAME_SOURCE,
  type FrameTick,
  type PoseFrameSource,
} from './pose-frame-source.port';
import { PoseHoldTimerService } from './pose-hold-timer.service';

class FakeDetector implements PoseDetector {
  script: ReadonlyArray<ReadonlyArray<PoseLandmark>> = [];
  cursor = 0;
  closed = false;
  detectForVideo(): PoseDetectionResult {
    const lm = this.script[this.cursor++] ?? [];
    return { landmarks: lm.length ? [lm] : [] };
  }
  close(): void {
    this.closed = true;
  }
}

class FakeFrameSource implements PoseFrameSource {
  private cb: ((t: FrameTick) => void) | null = null;
  videoBound: HTMLVideoElement | null = null;
  subscribed = 0;
  unsubscribed = 0;
  subscribe(video: HTMLVideoElement, cb: (t: FrameTick) => void): () => void {
    this.videoBound = video;
    this.cb = cb;
    this.subscribed += 1;
    return () => {
      this.cb = null;
      this.unsubscribed += 1;
    };
  }
  emit(timestampMs: number): void {
    this.cb?.({ timestampMs });
  }
}

const VISIBLE = 0.9;
const makeLandmarks = (
  overrides: Partial<Record<number, PoseLandmark>>
): ReadonlyArray<PoseLandmark> => {
  const arr: PoseLandmark[] = [];
  for (let i = 0; i < 33; i++) arr[i] = { x: 0, y: 0, visibility: 0 };
  for (const [idx, lm] of Object.entries(overrides)) {
    if (lm) arr[Number(idx)] = lm;
  }
  return arr;
};

/**
 * Hip-flexion triplet near 180° (body straight). Shoulder ←→ hip ←→ knee
 * are co-linear in x, with the hip in the middle, so the joint angle
 * is 180° — well inside the plank `inPoseAngleDeg = 160`.
 */
const STRAIGHT_PLANK = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_HIP]: { x: 1, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_KNEE]: { x: 2, y: 0, visibility: VISIBLE },
});

/**
 * Hip sagged — knee dropped sharply, producing a ~90° angle at the hip,
 * well below the plank `outPoseAngleDeg = 140`.
 */
const SAGGED_HIP = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_HIP]: { x: 1, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_KNEE]: { x: 1, y: 1, visibility: VISIBLE },
});

const configure = (params: {
  detector: FakeDetector;
  frameSource: FakeFrameSource;
  platformId?: object | string;
  detectorFactory?: () => Promise<PoseDetector>;
}): void => {
  const factory =
    params.detectorFactory ?? (() => Promise.resolve(params.detector));
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: params.platformId ?? 'browser' },
      { provide: POSE_DETECTOR_FACTORY, useValue: factory },
      { provide: POSE_FRAME_SOURCE, useValue: params.frameSource },
      PoseHoldTimerService,
    ],
  });
};

describe('PoseHoldTimerService', () => {
  let detector: FakeDetector;
  let frameSource: FakeFrameSource;
  let video: HTMLVideoElement;

  beforeEach(() => {
    detector = new FakeDetector();
    frameSource = new FakeFrameSource();
    video = document.createElement('video');
    configure({ detector, frameSource });
  });

  it('given a fresh service, when nothing happens, then isActive is false and snapshot is idle/0', () => {
    const svc = TestBed.inject(PoseHoldTimerService);
    expect(svc.isActive()).toBe(false);
    expect(svc.snapshot()).toEqual({
      totalMs: 0,
      phase: 'idle',
      segmentStartMs: null,
    });
  });

  it('given start without bindVideoElement, when called, then it rejects with a helpful error', async () => {
    const svc = TestBed.inject(PoseHoldTimerService);
    await expect(svc.start({ exerciseId: 'plank' })).rejects.toThrow(
      /bindVideoElement/
    );
  });

  it('given an unknown exercise id, when start is called, then it rejects with a profile-missing error', async () => {
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await expect(svc.start({ exerciseId: 'not-a-real-id' })).rejects.toThrow(
      /no hold profile/
    );
  });

  it('given a steady plank pose over 1.2s of frames, when emitted, then snapshot transitions to holding with accumulated time', async () => {
    detector.script = [
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
    ];
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'plank' });
    expect(svc.isActive()).toBe(true);

    frameSource.emit(0);
    frameSource.emit(300);
    frameSource.emit(600);
    frameSource.emit(900);
    frameSource.emit(1200);

    expect(svc.snapshot().phase).toBe('holding');
    expect(svc.snapshot().totalMs).toBeGreaterThanOrEqual(1200);
  });

  it('given a steady plank followed by sustained sag, when emitted, then snapshot transitions to paused with preserved total', async () => {
    detector.script = [
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      STRAIGHT_PLANK,
      SAGGED_HIP,
      SAGGED_HIP,
      SAGGED_HIP,
      SAGGED_HIP,
    ];
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'plank' });

    frameSource.emit(0);
    frameSource.emit(300);
    frameSource.emit(600);
    frameSource.emit(900);
    frameSource.emit(1000);
    frameSource.emit(1300);
    frameSource.emit(1600);
    frameSource.emit(1900);

    expect(svc.snapshot().phase).toBe('paused');
    expect(svc.snapshot().totalMs).toBeGreaterThanOrEqual(800);
    expect(svc.snapshot().totalMs).toBeLessThanOrEqual(1100);
  });

  it('given an active session, when reset is called, then snapshot returns to idle/0', async () => {
    detector.script = [STRAIGHT_PLANK, STRAIGHT_PLANK, STRAIGHT_PLANK];
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'plank' });

    frameSource.emit(0);
    frameSource.emit(300);
    frameSource.emit(600);
    expect(svc.snapshot().phase).toBe('holding');

    svc.reset();
    expect(svc.snapshot()).toEqual({
      totalMs: 0,
      phase: 'idle',
      segmentStartMs: null,
    });
  });

  it('given stop after start, when called, then frames unsubscribe and detector is closed', async () => {
    detector.script = [STRAIGHT_PLANK];
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'plank' });
    expect(svc.isActive()).toBe(true);

    await svc.stop();
    expect(svc.isActive()).toBe(false);
    expect(frameSource.unsubscribed).toBe(1);
    expect(detector.closed).toBe(true);
  });

  it('given the platform is server, when start is called, then it no-ops without subscribing to frames', async () => {
    TestBed.resetTestingModule();
    configure({ detector, frameSource, platformId: 'server' });
    const svc = TestBed.inject(PoseHoldTimerService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'plank' });
    expect(svc.isActive()).toBe(false);
    expect(frameSource.subscribed).toBe(0);
  });
});
