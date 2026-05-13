import { InjectionToken } from '@angular/core';

/** MediaPipe-style pose landmark indices we actually use. */
export const POSE_LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const;

export interface PoseLandmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  /** Detector visibility in `[0, 1]`. Treated as 0 when missing. */
  readonly visibility?: number;
}

export interface PoseDetectionResult {
  /** Landmark sets, one per detected pose. Empty when no pose found. */
  readonly landmarks: ReadonlyArray<ReadonlyArray<PoseLandmark>>;
}

export interface PoseDetector {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number
  ): PoseDetectionResult;
  close(): void;
}

/**
 * Async factory because the real adapter lazy-loads MediaPipe + a model
 * file. Resolves once per `start()` call so the lib never imports the
 * heavy WASM/model assets at module load time.
 */
export const POSE_DETECTOR_FACTORY = new InjectionToken<
  () => Promise<PoseDetector>
>('POSE_DETECTOR_FACTORY');
