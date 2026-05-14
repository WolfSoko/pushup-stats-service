import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';

export type CameraFacingMode = 'user' | 'environment';

/**
 * Thin `getUserMedia` wrapper used by the auto-count dialog. Owns the
 * `MediaStream` so multiple components can't accidentally double-open
 * the camera, and exposes a small surface (`open` + `close`) that
 * mirrors how the dialog uses it. Browser-only via the platform check.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly platformId = inject(PLATFORM_ID);
  private stream: MediaStream | null = null;

  async open(
    video: HTMLVideoElement,
    facingMode: CameraFacingMode = 'user'
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.stream) await this.close();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode,
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });

    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    try {
      await video.play();
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
      throw err;
    }
    this.stream = stream;
  }

  async close(): Promise<void> {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) track.stop();
    this.stream = null;
  }
}
