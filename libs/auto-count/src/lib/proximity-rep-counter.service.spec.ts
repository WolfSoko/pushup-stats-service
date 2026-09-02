import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  FRAME_LUMA_SAMPLER,
  type FrameLumaSampler,
} from './frame-luma-sampler.port';
import {
  POSE_FRAME_SOURCE,
  type FrameTick,
  type PoseFrameSource,
} from './pose-frame-source.port';
import { ProximityRepCounterService } from './proximity-rep-counter.service';

class FakeFrameSource implements PoseFrameSource {
  private cb: ((t: FrameTick) => void) | null = null;
  subscribed = 0;
  unsubscribed = 0;
  subscribe(_video: HTMLVideoElement, cb: (t: FrameTick) => void): () => void {
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

class FakeSampler implements FrameLumaSampler {
  luma: number | null = 0.8;
  sample(): number | null {
    return this.luma;
  }
}

describe('ProximityRepCounterService', () => {
  let frames: FakeFrameSource;
  let sampler: FakeSampler;
  let service: ProximityRepCounterService;
  const video = {} as HTMLVideoElement;

  function setup(platform: 'browser' | 'server' = 'browser'): void {
    frames = new FakeFrameSource();
    sampler = new FakeSampler();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProximityRepCounterService,
        { provide: PLATFORM_ID, useValue: platform },
        { provide: POSE_FRAME_SOURCE, useValue: frames },
        { provide: FRAME_LUMA_SAMPLER, useValue: sampler },
      ],
    });
    service = TestBed.inject(ProximityRepCounterService);
  }

  /** Feed `luma` for `ms` milliseconds at 50 fps starting at `from`. */
  function hold(luma: number, from: number, ms: number): number {
    sampler.luma = luma;
    for (let t = from; t <= from + ms; t += 20) frames.emit(t);
    return from + ms + 20;
  }

  beforeEach(() => setup());

  it('should count one rep per bright → dark → bright swing', async () => {
    // given
    service.bindVideoElement(video);
    await service.start({ exerciseId: 'pushup' });
    let t = hold(0.8, 0, 400);

    // when — three pushups over the phone
    for (let i = 0; i < 3; i++) {
      t = hold(0.2, t, 400);
      t = hold(0.8, t, 400);
    }

    // then
    expect(service.snapshot().count).toBe(3);
    expect(service.snapshot().phase).toBe('up');
    expect(service.isActive()).toBe(true);
  });

  it('should ignore a brief flicker shorter than the dwell time', async () => {
    // given
    service.bindVideoElement(video);
    await service.start({ exerciseId: 'pushup' });
    let t = hold(0.8, 0, 400);
    t = hold(0.2, t, 400);
    t = hold(0.8, t, 400);
    expect(service.snapshot().count).toBe(1);

    // when — a 60 ms shadow
    t = hold(0.2, t, 60);
    hold(0.8, t, 400);

    // then
    expect(service.snapshot().count).toBe(1);
  });

  it('should surface the near/far position and clear it when no frame is decoded', async () => {
    // given
    service.bindVideoElement(video);
    await service.start({ exerciseId: 'pushup' });
    let t = hold(0.8, 0, 200);
    t = hold(0.2, t, 200);

    // then — dark = near = 0°
    expect(service.formCheckFrame()?.angleDeg).toBeCloseTo(0, 0);
    expect(service.formCheckFrame()?.confidence).toBe(1);

    // when
    sampler.luma = null;
    frames.emit(t);

    // then
    expect(service.formCheckFrame()).toBeNull();
  });

  it('should reset the count and the calibration', async () => {
    // given
    service.bindVideoElement(video);
    await service.start({ exerciseId: 'pushup' });
    let t = hold(0.8, 0, 400);
    t = hold(0.2, t, 400);
    t = hold(0.8, t, 400);

    // when
    service.reset();

    // then
    expect(service.snapshot().count).toBe(0);
    expect(service.snapshot().phase).toBe('awaiting-up');
    frames.emit(t);
    expect(service.formCheckFrame()?.confidence).toBe(0);
  });

  it('should unsubscribe from frames on stop and refuse to start without a video', async () => {
    // given
    await expect(service.start({ exerciseId: 'pushup' })).rejects.toThrow(
      /bindVideoElement/
    );
    service.bindVideoElement(video);
    await service.start({ exerciseId: 'pushup' });

    // when
    await service.stop();

    // then
    expect(frames.unsubscribed).toBe(1);
    expect(service.isActive()).toBe(false);
  });

  it('should stay idle on the server', async () => {
    // given
    setup('server');
    service.bindVideoElement(video);

    // when
    await service.start({ exerciseId: 'pushup' });

    // then
    expect(frames.subscribed).toBe(0);
    expect(service.isActive()).toBe(false);
  });
});
