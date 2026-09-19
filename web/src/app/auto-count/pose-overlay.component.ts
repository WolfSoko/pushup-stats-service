import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import type { PoseSkeleton } from '@pu-stats/auto-count';

import { drawPoseOverlay } from './draw-pose-overlay';
import { coverProjector } from './pose-overlay-projection';

/**
 * Canvas overlay that draws the detected pose onto the camera preview.
 * Purely presentational: it redraws whenever the `skeleton` input
 * changes — which is once per detected frame, the same cadence at which
 * the form-check numbers already update.
 *
 * Deliberately *not* CSS-mirrored even though the preview is: the
 * mirror lives in the coordinate projection, so the angle label stays
 * readable.
 */
@Component({
  selector: 'app-pose-overlay',
  standalone: true,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
    }

    canvas {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoseOverlayComponent {
  /** Source of truth for the frame dimensions the landmarks refer to. */
  readonly video = input<HTMLVideoElement | null>(null);
  readonly skeleton = input<PoseSkeleton | null>(null);
  readonly angleDeg = input<number | null>(null);
  /** Must match the preview's `transform: scaleX(-1)`. */
  readonly mirrored = input(true);

  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    effect(() => {
      const skeleton = this.skeleton();
      const angleDeg = this.angleDeg();
      const mirrored = this.mirrored();
      const video = this.video();
      if (!isPlatformBrowser(this.platformId)) return;
      this.render(video, skeleton, angleDeg, mirrored);
    });
  }

  private render(
    video: HTMLVideoElement | null,
    skeleton: PoseSkeleton | null,
    angleDeg: number | null,
    mirrored: boolean
  ): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stage = { width: canvas.clientWidth, height: canvas.clientHeight };
    // Sizing off the element's own box instead of a ResizeObserver: we
    // are called every frame anyway, so a resize is picked up on the
    // next one for free.
    const ratio = globalThis.devicePixelRatio || 1;
    const backingWidth = Math.round(stage.width * ratio);
    const backingHeight = Math.round(stage.height * ratio);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, stage.width, stage.height);
    if (!skeleton || !video) return;

    const project = coverProjector(
      { width: video.videoWidth, height: video.videoHeight },
      stage,
      mirrored
    );
    if (!project) return;

    drawPoseOverlay({ ctx, skeleton, project, angleDeg });
  }
}
