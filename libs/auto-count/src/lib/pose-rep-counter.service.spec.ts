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
import { PoseRepCounterService } from './pose-rep-counter.service';

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

const STRAIGHT = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_WRIST]: { x: 2, y: 0, visibility: VISIBLE },
});
const BENT_90 = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 0, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_ELBOW]: { x: 1, y: 0, visibility: VISIBLE },
  [POSE_LANDMARK.LEFT_WRIST]: { x: 1, y: 1, visibility: VISIBLE },
});
const CLEAN_REP_FRAMES: ReadonlyArray<ReadonlyArray<PoseLandmark>> = [
  STRAIGHT,
  STRAIGHT,
  BENT_90,
  BENT_90,
  STRAIGHT,
  STRAIGHT,
];
const CLEAN_REP_TICKS = [0, 250, 300, 550, 600, 850];

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
      PoseRepCounterService,
    ],
  });
};

describe('PoseRepCounterService', () => {
  let detector: FakeDetector;
  let frameSource: FakeFrameSource;
  let video: HTMLVideoElement;

  beforeEach(() => {
    detector = new FakeDetector();
    frameSource = new FakeFrameSource();
    video = document.createElement('video');
    configure({ detector, frameSource });
  });

  it('given a fresh service, when nothing happens, then isActive is false and count is 0', () => {
    const svc = TestBed.inject(PoseRepCounterService);
    expect(svc.isActive()).toBe(false);
    expect(svc.snapshot()).toEqual({
      count: 0,
      phase: 'awaiting-up',
      lastRepAtMs: null,
    });
  });

  it('given start without video binding, when called, then rejects with a helpful error', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    await expect(svc.start({ exerciseId: 'pushup' })).rejects.toThrow(
      /bindVideoElement/
    );
  });

  it('given an unknown exercise id, when start is called, then rejects', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    await expect(svc.start({ exerciseId: 'unknown-exercise' })).rejects.toThrow(
      /unknown-exercise/
    );
  });

  it('given a clean rep emitted as frames, when processed, then count increments by 1', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    detector.script = CLEAN_REP_FRAMES;
    await svc.start({ exerciseId: 'pushup' });
    expect(svc.isActive()).toBe(true);

    for (const t of CLEAN_REP_TICKS) frameSource.emit(t);

    expect(svc.snapshot().count).toBe(1);
    expect(svc.snapshot().phase).toBe('up');
    expect(svc.snapshot().lastRepAtMs).toBe(850);
  });

  it('given an active service, when stop is called, then isActive flips false and detector closes', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'pushup' });
    expect(frameSource.subscribed).toBe(1);

    await svc.stop();

    expect(svc.isActive()).toBe(false);
    expect(detector.closed).toBe(true);
    expect(frameSource.unsubscribed).toBe(1);
  });

  it('given non-browser platform, when start is called, then it is a no-op and remains inactive', async () => {
    TestBed.resetTestingModule();
    configure({ detector, frameSource, platformId: 'server' });
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);

    await svc.start({ exerciseId: 'pushup' });

    expect(svc.isActive()).toBe(false);
    expect(detector.cursor).toBe(0);
    expect(frameSource.subscribed).toBe(0);
  });

  it('given a counted rep, when reset is called, then snapshot returns to initial', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    detector.script = CLEAN_REP_FRAMES;
    await svc.start({ exerciseId: 'pushup' });
    for (const t of CLEAN_REP_TICKS) frameSource.emit(t);
    expect(svc.snapshot().count).toBe(1);

    svc.reset();

    expect(svc.snapshot()).toEqual({
      count: 0,
      phase: 'awaiting-up',
      lastRepAtMs: null,
    });
  });

  it('given start is called twice while active, when re-entered, then the second call is a no-op', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    await svc.start({ exerciseId: 'pushup' });
    await svc.start({ exerciseId: 'pushup' });
    expect(frameSource.subscribed).toBe(1);
  });

  it('given start is called again while a previous start is awaiting the detector, then second call is a no-op', async () => {
    TestBed.resetTestingModule();
    let resolveFactory: ((d: PoseDetector) => void) | null = null;
    configure({
      detector,
      frameSource,
      detectorFactory: () =>
        new Promise<PoseDetector>((resolve) => {
          resolveFactory = resolve;
        }),
    });
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);

    const first = svc.start({ exerciseId: 'pushup' });
    const second = svc.start({ exerciseId: 'pushup' });

    expect(resolveFactory).not.toBeNull();
    (resolveFactory as unknown as (d: PoseDetector) => void)(detector);
    await Promise.all([first, second]);

    expect(frameSource.subscribed).toBe(1);
  });

  it('given stop is called while start is awaiting the detector, then the detector is closed and no subscription is created', async () => {
    TestBed.resetTestingModule();
    let resolveFactory: ((d: PoseDetector) => void) | null = null;
    configure({
      detector,
      frameSource,
      detectorFactory: () =>
        new Promise<PoseDetector>((resolve) => {
          resolveFactory = resolve;
        }),
    });
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);

    const starting = svc.start({ exerciseId: 'pushup' });
    await svc.stop();
    (resolveFactory as unknown as (d: PoseDetector) => void)(detector);
    await starting;

    expect(svc.isActive()).toBe(false);
    expect(detector.closed).toBe(true);
    expect(frameSource.subscribed).toBe(0);
  });

  it('given frames that do not change phase or count, when processed, then the snapshot signal returns the same reference', async () => {
    const svc = TestBed.inject(PoseRepCounterService);
    svc.bindVideoElement(video);
    detector.script = [STRAIGHT, STRAIGHT, STRAIGHT];
    await svc.start({ exerciseId: 'pushup' });

    const before = svc.snapshot();
    frameSource.emit(0);
    frameSource.emit(50);
    frameSource.emit(100);

    expect(svc.snapshot()).toBe(before);
  });
});
