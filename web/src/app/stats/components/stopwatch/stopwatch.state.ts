import { computed, signal } from '@angular/core';

/** How often the elapsed display is refreshed while running. */
export const STOPWATCH_TICK_MS = 100;

/**
 * Wall-clock stopwatch with start/pause/reset, as signals.
 *
 * The elapsed time is `segmentBase + (now - segmentStart)` on every tick
 * and recomputed the same way on pause, so a pause landing between two
 * ticks never double-counts the last partial tick. `performance.now()`
 * keeps it immune to system-clock jumps.
 *
 * Owned by whoever renders it — a dialog, the entry form — so one class
 * serves the guided session, the hold timer's manual mode and the
 * duration field of the entry dialog.
 */
export class StopwatchState {
  private readonly elapsedMs = signal(0);
  private readonly runningState = signal(false);
  private segmentStartedAt: number | null = null;
  private segmentBaseMs = 0;
  private handle: ReturnType<typeof setInterval> | null = null;

  readonly running = this.runningState.asReadonly();
  readonly elapsedSec = computed(() => Math.floor(this.elapsedMs() / 1000));

  constructor(
    private readonly isBrowser: boolean,
    private readonly tickMs = STOPWATCH_TICK_MS
  ) {}

  start(): void {
    if (!this.isBrowser || this.runningState()) return;
    this.segmentStartedAt = performance.now();
    this.segmentBaseMs = this.elapsedMs();
    this.runningState.set(true);
    this.handle = setInterval(() => this.sync(), this.tickMs);
  }

  pause(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
    if (this.runningState()) this.sync();
    this.segmentStartedAt = null;
    this.runningState.set(false);
  }

  toggle(): void {
    if (this.runningState()) {
      this.pause();
    } else {
      this.start();
    }
  }

  reset(): void {
    this.pause();
    this.elapsedMs.set(0);
  }

  destroy(): void {
    this.pause();
  }

  private sync(): void {
    if (this.segmentStartedAt === null) return;
    this.elapsedMs.set(
      this.segmentBaseMs + (performance.now() - this.segmentStartedAt)
    );
  }
}

/** `mm:ss` for timer displays (`00:50`); hours roll into the minutes. */
export function formatStopwatch(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

/**
 * Fires a callback once per crossing of the target, then re-arms when the
 * timer drops below it again (a reset). Shared between every timer
 * surface so each doesn't keep its own "already beeped" flag.
 */
export class TargetSignal {
  private announced = false;

  constructor(private readonly play: () => void) {}

  update(reached: boolean): void {
    if (!reached) {
      this.announced = false;
      return;
    }
    if (this.announced) return;
    this.announced = true;
    this.play();
  }
}
