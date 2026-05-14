import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { type FrameTick, type PoseFrameSource } from '@pu-stats/auto-count';

type RvfcCallback = (
  now: DOMHighResTimeStamp,
  metadata: { mediaTime: number }
) => void;

interface RvfcApi {
  requestVideoFrameCallback(cb: RvfcCallback): number;
  cancelVideoFrameCallback(handle: number): void;
}

function asRvfc(video: HTMLVideoElement): RvfcApi | null {
  const candidate = video as unknown as Partial<RvfcApi>;
  if (
    typeof candidate.requestVideoFrameCallback === 'function' &&
    typeof candidate.cancelVideoFrameCallback === 'function'
  ) {
    return candidate as RvfcApi;
  }
  return null;
}

/**
 * Browser-native frame source. Uses `requestVideoFrameCallback` where
 * available (Chrome/Edge/Firefox/Safari 17+) so detection runs in lock-
 * step with actual decoded video frames — no busy-wait, no double
 * detections on the same frame. Falls back to `requestAnimationFrame`
 * on older Safari, and SSR is short-circuited via the platform check.
 */
@Injectable({ providedIn: 'root' })
export class VideoFrameRafSource implements PoseFrameSource {
  private readonly platformId = inject(PLATFORM_ID);

  subscribe(
    video: HTMLVideoElement,
    onTick: (tick: FrameTick) => void
  ): () => void {
    if (!isPlatformBrowser(this.platformId)) {
      return () => undefined;
    }

    let stopped = false;
    let rvfcHandle: number | undefined;
    let rafHandle: number | undefined;

    const rvfc = asRvfc(video);
    if (rvfc) {
      const tick: RvfcCallback = (now) => {
        if (stopped) return;
        onTick({ timestampMs: now });
        rvfcHandle = rvfc.requestVideoFrameCallback(tick);
      };
      rvfcHandle = rvfc.requestVideoFrameCallback(tick);
    } else {
      const tick = (now: DOMHighResTimeStamp): void => {
        if (stopped) return;
        onTick({ timestampMs: now });
        rafHandle = requestAnimationFrame(tick);
      };
      rafHandle = requestAnimationFrame(tick);
    }

    return (): void => {
      stopped = true;
      if (rvfcHandle != null && rvfc) {
        rvfc.cancelVideoFrameCallback(rvfcHandle);
      }
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
    };
  }
}
