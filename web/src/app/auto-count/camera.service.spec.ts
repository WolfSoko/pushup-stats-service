import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CameraService } from './camera.service';

interface FakeTrack {
  stopped: boolean;
}

const makeFakeStream = (): MediaStream & { trackList: FakeTrack[] } => {
  const trackList: FakeTrack[] = [{ stopped: false }, { stopped: false }];
  return {
    trackList,
    getTracks: () =>
      trackList.map(
        (t) =>
          ({
            stop: () => {
              t.stopped = true;
            },
          }) as unknown as MediaStreamTrack
      ),
  } as unknown as MediaStream & { trackList: FakeTrack[] };
};

describe('CameraService', () => {
  let getUserMediaSpy: ReturnType<typeof vi.fn>;
  let originalMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    originalMediaDevices = navigator.mediaDevices;
    getUserMediaSpy = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaSpy },
    });

    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it('given open is called, when getUserMedia resolves, then the stream is attached to the video and play is invoked', async () => {
    const stream = makeFakeStream();
    getUserMediaSpy.mockResolvedValue(stream);
    const video = document.createElement('video');
    const playSpy = vi.spyOn(video, 'play').mockResolvedValue();

    const service = TestBed.inject(CameraService);
    await service.open(video);

    expect(getUserMediaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ facingMode: 'user' }),
      })
    );
    expect(video.srcObject).toBe(stream);
    expect(playSpy).toHaveBeenCalled();
  });

  it('given an active stream, when close is called, then every track is stopped', async () => {
    const stream = makeFakeStream();
    getUserMediaSpy.mockResolvedValue(stream);
    const video = document.createElement('video');
    vi.spyOn(video, 'play').mockResolvedValue();

    const service = TestBed.inject(CameraService);
    await service.open(video);
    await service.close();

    expect(stream.trackList.every((t) => t.stopped)).toBe(true);
  });

  it('given video.play rejects, when open is called, then the stream is fully stopped and not retained', async () => {
    const stream = makeFakeStream();
    getUserMediaSpy.mockResolvedValue(stream);
    const video = document.createElement('video');
    vi.spyOn(video, 'play').mockRejectedValue(new Error('autoplay blocked'));

    const service = TestBed.inject(CameraService);
    await expect(service.open(video)).rejects.toThrow(/autoplay blocked/);

    expect(stream.trackList.every((t) => t.stopped)).toBe(true);
    expect(video.srcObject).toBeNull();

    await service.close();
    // Second close should be a no-op — no extra track.stop calls would
    // be possible because the stream reference was already cleared.
    expect(stream.trackList.every((t) => t.stopped)).toBe(true);
  });

  it('given non-browser platform, when open is called, then getUserMedia is not invoked', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(CameraService);
    const video = document.createElement('video');

    await service.open(video);

    expect(getUserMediaSpy).not.toHaveBeenCalled();
  });
});
