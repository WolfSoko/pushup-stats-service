import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CanvasLumaSampler } from './canvas-luma-sampler';

describe('CanvasLumaSampler', () => {
  function setup(platform: 'browser' | 'server'): CanvasLumaSampler {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(CanvasLumaSampler);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should average the luma of the downsampled frame', () => {
    // given — a 16×12 frame that is half white, half black
    const pixels = 16 * 12;
    const data = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      const v = i < pixels / 2 ? 255 : 0;
      data.set([v, v, v, 255], i * 4);
    }
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data })),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D
    );
    const sampler = setup('browser');
    const video = { readyState: 4 } as HTMLVideoElement;

    // when
    const luma = sampler.sample(video);

    // then
    expect(luma).toBeCloseTo(0.5, 5);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 16, 12);
  });

  it('should return null before the video has a decoded frame', () => {
    // given
    const sampler = setup('browser');

    // when / then
    expect(sampler.sample({ readyState: 0 } as HTMLVideoElement)).toBeNull();
  });

  it('should return null on the server', () => {
    // given
    const sampler = setup('server');

    // when / then
    expect(sampler.sample({ readyState: 4 } as HTMLVideoElement)).toBeNull();
  });
});
