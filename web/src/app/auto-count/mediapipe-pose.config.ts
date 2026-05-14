import { InjectionToken } from '@angular/core';

/**
 * Runtime config for the MediaPipe pose adapter. Hosted on Google's
 * CDN by default — both URLs are well-known stable paths from
 * MediaPipe's official documentation. Override at provider time for
 * self-hosting, air-gapped builds, or model variant swaps.
 */
export interface MediaPipePoseConfig {
  /** URL where the FilesetResolver can locate the vision wasm runtime. */
  readonly wasmBaseUrl: string;
  /** URL of the `.task` pose landmarker model file. */
  readonly modelAssetUrl: string;
  /**
   * Compute target. `'GPU'` uses WebGL when available, falling back to
   * CPU automatically; `'CPU'` forces software inference.
   */
  readonly delegate?: 'GPU' | 'CPU';
}

export const MEDIAPIPE_POSE_CONFIG = new InjectionToken<MediaPipePoseConfig>(
  'MEDIAPIPE_POSE_CONFIG'
);

export const DEFAULT_MEDIAPIPE_POSE_CONFIG: MediaPipePoseConfig = {
  wasmBaseUrl:
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  modelAssetUrl:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  delegate: 'GPU',
};
