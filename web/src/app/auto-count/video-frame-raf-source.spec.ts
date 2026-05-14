import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type FrameTick } from '@pu-stats/auto-count';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoFrameRafSource } from './video-frame-raf-source';

type RvfcCallback = (now: number, meta: { mediaTime: number }) => void;

interface FakeRvfcState {
  callbacks: RvfcCallback[];
  cancelled: number[];
}

const makeFakeRvfcVideo = (): {
  video: HTMLVideoElement;
  state: FakeRvfcState;
} => {
  const state: FakeRvfcState = { callbacks: [], cancelled: [] };
  const video = document.createElement('video');
  Object.assign(video, {
    requestVideoFrameCallback: (cb: RvfcCallback): number => {
      state.callbacks.push(cb);
      return state.callbacks.length;
    },
    cancelVideoFrameCallback: (handle: number): void => {
      state.cancelled.push(handle);
    },
  });
  return { video, state };
};

describe('VideoFrameRafSource', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  it('given a video with requestVideoFrameCallback, when subscribed, then ticks are forwarded with the now timestamp', () => {
    const source = TestBed.inject(VideoFrameRafSource);
    const { video, state } = makeFakeRvfcVideo();
    const ticks: FrameTick[] = [];

    source.subscribe(video, (t) => ticks.push(t));

    state.callbacks[0]?.(100, { mediaTime: 0.1 });
    state.callbacks[1]?.(150, { mediaTime: 0.15 });

    expect(ticks).toEqual([{ timestampMs: 100 }, { timestampMs: 150 }]);
  });

  it('given unsubscribe is called, when the next frame fires, then no further ticks are emitted', () => {
    const source = TestBed.inject(VideoFrameRafSource);
    const { video, state } = makeFakeRvfcVideo();
    const ticks: FrameTick[] = [];

    const unsubscribe = source.subscribe(video, (t) => ticks.push(t));
    state.callbacks[0]?.(100, { mediaTime: 0.1 });
    unsubscribe();
    state.callbacks[1]?.(150, { mediaTime: 0.15 });

    expect(ticks).toEqual([{ timestampMs: 100 }]);
    expect(state.cancelled.length).toBeGreaterThan(0);
  });

  it('given non-browser platform, when subscribed, then no callback is registered', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const source = TestBed.inject(VideoFrameRafSource);
    const { video, state } = makeFakeRvfcVideo();
    const ticks: FrameTick[] = [];

    source.subscribe(video, (t) => ticks.push(t));

    expect(state.callbacks).toEqual([]);
    expect(ticks).toEqual([]);
  });

  it('given a video without requestVideoFrameCallback, when subscribed, then requestAnimationFrame drives ticks', () => {
    const source = TestBed.inject(VideoFrameRafSource);
    const plainVideo = document.createElement('video');
    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    const cancelSpy = vi
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const ticks: FrameTick[] = [];

    const unsubscribe = source.subscribe(plainVideo, (t) => ticks.push(t));
    rafCallbacks[0]?.(123);
    unsubscribe();

    expect(ticks).toEqual([{ timestampMs: 123 }]);
    expect(cancelSpy).toHaveBeenCalled();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
