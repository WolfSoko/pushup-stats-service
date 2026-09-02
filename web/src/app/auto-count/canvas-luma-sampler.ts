import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import type { FrameLumaSampler } from '@pu-stats/auto-count';

/** Downsample target — a 16×12 thumbnail is plenty for a mean and cheap per frame. */
const SAMPLE_WIDTH = 16;
const SAMPLE_HEIGHT = 12;

/**
 * Browser adapter for {@link FrameLumaSampler}: draws the current video
 * frame onto a tiny offscreen canvas and averages the Rec. 601 luma of
 * its pixels. The canvas is created lazily and reused across frames.
 */
@Injectable({ providedIn: 'root' })
export class CanvasLumaSampler implements FrameLumaSampler {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private context: CanvasRenderingContext2D | null = null;

  sample(video: HTMLVideoElement): number | null {
    if (!this.isBrowser) return null;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    const ctx = this.contextOrNull();
    if (!ctx) return null;
    try {
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      return sum / (data.length / 4) / 255;
    } catch {
      return null;
    }
  }

  private contextOrNull(): CanvasRenderingContext2D | null {
    if (this.context) return this.context;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    this.context = canvas.getContext('2d', { willReadFrequently: true });
    return this.context;
  }
}
