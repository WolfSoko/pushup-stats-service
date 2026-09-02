import { InjectionToken } from '@angular/core';

/**
 * Reads the mean brightness (0..1) of the current video frame. The
 * browser adapter downsamples through a canvas; tests feed numbers.
 * Returns `null` while the video has no decoded frame yet.
 */
export interface FrameLumaSampler {
  sample(video: HTMLVideoElement): number | null;
}

export const FRAME_LUMA_SAMPLER = new InjectionToken<FrameLumaSampler>(
  'FRAME_LUMA_SAMPLER'
);
