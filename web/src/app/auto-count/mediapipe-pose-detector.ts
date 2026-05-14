import type { Provider } from '@angular/core';
import {
  POSE_DETECTOR_FACTORY,
  type PoseDetectionResult,
  type PoseDetector,
} from '@pu-stats/auto-count';

import {
  MEDIAPIPE_POSE_CONFIG,
  type MediaPipePoseConfig,
} from './mediapipe-pose.config';

/**
 * Minimal subset of `PoseLandmarker` we depend on. Declaring it here
 * (instead of importing the type directly) keeps the adapter file
 * usable in tests without dragging in MediaPipe's heavy module graph.
 */
export interface MediaPipePoseLandmarkerLike {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number
  ): { landmarks: ReadonlyArray<ReadonlyArray<unknown>> };
  close(): void;
}

/**
 * Adapter wrapping MediaPipe's `PoseLandmarker` in the lib's
 * `PoseDetector` port. The lazy factory below imports the heavy
 * module only on first `start()` so MediaPipe never lands in the
 * initial bundle.
 */
export class MediaPipePoseDetector implements PoseDetector {
  constructor(private readonly inner: MediaPipePoseLandmarkerLike) {}

  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number
  ): PoseDetectionResult {
    return this.inner.detectForVideo(video, timestampMs) as PoseDetectionResult;
  }

  close(): void {
    this.inner.close();
  }
}

const createDetector = async (
  config: MediaPipePoseConfig
): Promise<PoseDetector> => {
  const { FilesetResolver, PoseLandmarker } =
    await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(config.wasmBaseUrl);
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: config.modelAssetUrl,
      delegate: config.delegate ?? 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  return new MediaPipePoseDetector(landmarker);
};

/**
 * Provider for the `POSE_DETECTOR_FACTORY` port that loads
 * `@mediapipe/tasks-vision` lazily on the first `start()` call.
 * Browser-only: only register in `app.browser.config.ts` so SSR
 * prerender does not pull MediaPipe into the server bundle.
 */
export function provideMediaPipePoseDetector(): Provider {
  return {
    provide: POSE_DETECTOR_FACTORY,
    useFactory: (config: MediaPipePoseConfig) => (): Promise<PoseDetector> =>
      createDetector(config),
    deps: [MEDIAPIPE_POSE_CONFIG],
  };
}
