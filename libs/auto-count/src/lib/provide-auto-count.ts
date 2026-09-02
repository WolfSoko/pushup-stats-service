import type { Provider } from '@angular/core';

import { HOLD_TIMER } from './hold-timer.port';
import { PoseHoldTimerService } from './pose-hold-timer.service';
import { PoseRepCounterService } from './pose-rep-counter.service';
import {
  PROXIMITY_REP_COUNTER,
  ProximityRepCounterService,
} from './proximity-rep-counter.service';
import { REP_COUNTER } from './rep-counter.port';

/**
 * Wires all auto-count ports to their pose-based implementations:
 * {@link REP_COUNTER} → {@link PoseRepCounterService},
 * {@link PROXIMITY_REP_COUNTER} → {@link ProximityRepCounterService},
 * {@link HOLD_TIMER} → {@link PoseHoldTimerService}.
 *
 * Callers must separately provide {@link POSE_DETECTOR_FACTORY},
 * {@link POSE_FRAME_SOURCE} and {@link FRAME_LUMA_SAMPLER} — those
 * adapters are browser-specific (MediaPipe WASM, camera access, canvas)
 * and live at the app level so the lib stays platform-agnostic.
 *
 * @example
 * ```ts
 * // web/src/app/app.browser.config.ts
 * providers: [
 *   ...provideAutoCount(),
 *   ...provideMediaPipePoseDetector(),
 *   { provide: POSE_FRAME_SOURCE, useExisting: VideoFrameRafSource },
 * ]
 * ```
 */
export function provideAutoCount(): Provider[] {
  return [
    { provide: REP_COUNTER, useClass: PoseRepCounterService },
    { provide: PROXIMITY_REP_COUNTER, useClass: ProximityRepCounterService },
    { provide: HOLD_TIMER, useClass: PoseHoldTimerService },
  ];
}
