import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  untracked,
} from '@angular/core';

/**
 * Keeps the screen on while a timer or a camera measurement runs, via
 * the Screen Wake Lock API. Reference-counted so overlapping holders
 * (a session rest countdown behind a stopwatch dialog) share one
 * sentinel, and re-acquired when the tab becomes visible again because
 * the browser drops the lock whenever it is hidden. Every step is
 * best-effort: an unsupported browser or a denied request never throws
 * into the caller.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private holders = 0;
  private sentinel: WakeLockSentinel | null = null;
  private visibilityBound = false;

  /** Hold the screen awake until the returned release function is called. */
  retain(): () => void {
    this.holders += 1;
    if (this.holders === 1) void this.request();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders -= 1;
      if (this.holders === 0) void this.release();
    };
  }

  /**
   * Hold the lock exactly while `active()` is true. Must be called in an
   * injection context; the hold is dropped with the caller's destroy.
   */
  keepAwakeWhile(active: () => boolean): void {
    let release: (() => void) | null = null;
    effect(() => {
      const on = active();
      untracked(() => {
        if (on && !release) {
          release = this.retain();
        } else if (!on && release) {
          release();
          release = null;
        }
      });
    });
    inject(DestroyRef).onDestroy(() => release?.());
  }

  private async request(): Promise<void> {
    if (!this.isBrowser || this.sentinel) return;
    const wakeLock = navigator.wakeLock;
    if (!wakeLock) return;
    this.bindVisibility();
    try {
      const sentinel = await wakeLock.request('screen');
      if (this.holders === 0) {
        await sentinel.release();
        return;
      }
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      });
      this.sentinel = sentinel;
    } catch {
      // Low battery, permissions policy or a hidden tab — nothing to do.
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      // Already released by the browser.
    }
  }

  private bindVisibility(): void {
    if (this.visibilityBound) return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.holders > 0) {
        void this.request();
      }
    });
  }
}
