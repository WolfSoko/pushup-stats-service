import { effect, inject, untracked } from '@angular/core';
import { LiveDataStore } from '@pu-stats/data-access-state';

/**
 * Runs `callback` whenever the user's entries change after the first
 * snapshot — a logged workout moves challenge progress and the board,
 * and nobody should have to leave the page to see it. The first snapshot
 * is skipped: the component's own initial load covers that one.
 *
 * Call from an injection context (a constructor or field initializer).
 */
export function onEntriesChanged(callback: () => void): void {
  const live = inject(LiveDataStore);
  let seenTick: number | null = null;
  effect(() => {
    const tick = live.updateTick();
    if (!live.exerciseEntriesLoaded()) return;
    if (seenTick === null || tick === seenTick) {
      seenTick = tick;
      return;
    }
    seenTick = tick;
    untracked(callback);
  });
}
