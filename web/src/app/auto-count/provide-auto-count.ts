import type { Provider } from '@angular/core';
import {
  provideAutoCount as provideAutoCountLib,
  POSE_FRAME_SOURCE,
} from '@pu-stats/auto-count';

import { provideMediaPipePoseDetector } from './mediapipe-pose-detector';
import {
  DEFAULT_MEDIAPIPE_POSE_CONFIG,
  MEDIAPIPE_POSE_CONFIG,
} from './mediapipe-pose.config';
import { VideoFrameRafSource } from './video-frame-raf-source';

/**
 * Wires all auto-counter ports to their browser-only adapters in one
 * place: the MediaPipe pose detector behind its lazy factory, the
 * `requestVideoFrameCallback`-driven frame source, the default
 * MediaPipe config, and the concrete rep-counter + hold-timer
 * implementations. Call from `app.browser.config.ts` only — the
 * server config has no use for any of it and the WASM assets must
 * not be in the SSR bundle.
 */
export function provideAutoCount(): Provider[] {
  return [
    ...provideAutoCountLib(),
    { provide: MEDIAPIPE_POSE_CONFIG, useValue: DEFAULT_MEDIAPIPE_POSE_CONFIG },
    provideMediaPipePoseDetector(),
    { provide: POSE_FRAME_SOURCE, useExisting: VideoFrameRafSource },
  ];
}
