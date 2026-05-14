import { describe, expect, it } from 'vitest';

import {
  MediaPipePoseDetector,
  type MediaPipePoseLandmarkerLike,
} from './mediapipe-pose-detector';

describe('MediaPipePoseDetector', () => {
  it('given an inner landmarker, when detectForVideo is called, then the call is forwarded with the same args', () => {
    const inner: MediaPipePoseLandmarkerLike & {
      lastArgs: [HTMLVideoElement, number] | null;
    } = {
      lastArgs: null,
      detectForVideo(video, timestampMs) {
        this.lastArgs = [video, timestampMs];
        return { landmarks: [[{ x: 0.5, y: 0.5, visibility: 0.9 }]] };
      },
      close: () => undefined,
    };

    const detector = new MediaPipePoseDetector(inner);
    const video = document.createElement('video');
    const result = detector.detectForVideo(video, 42);

    expect(inner.lastArgs).toEqual([video, 42]);
    expect(result.landmarks.length).toBe(1);
  });

  it('given an active detector, when close is called, then the inner landmarker is closed', () => {
    let closed = false;
    const inner: MediaPipePoseLandmarkerLike = {
      detectForVideo: () => ({ landmarks: [] }),
      close: () => {
        closed = true;
      },
    };
    new MediaPipePoseDetector(inner).close();
    expect(closed).toBe(true);
  });
});
