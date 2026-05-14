import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { POSE_DETECTOR_FACTORY, POSE_FRAME_SOURCE } from '@pu-stats/auto-count';
import { describe, expect, it } from 'vitest';

import { provideAutoCount } from './provide-auto-count';
import { VideoFrameRafSource } from './video-frame-raf-source';

describe('provideAutoCount', () => {
  it('binds POSE_FRAME_SOURCE to the VideoFrameRafSource adapter', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        ...provideAutoCount(),
      ],
    });
    const frameSource = TestBed.inject(POSE_FRAME_SOURCE);
    expect(frameSource).toBeInstanceOf(VideoFrameRafSource);
  });

  it('provides a callable POSE_DETECTOR_FACTORY', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        ...provideAutoCount(),
      ],
    });
    expect(typeof TestBed.inject(POSE_DETECTOR_FACTORY)).toBe('function');
  });
});
