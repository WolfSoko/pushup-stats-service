import { DestroyRef, effect, inject, untracked } from '@angular/core';

import { XpCelebrationService } from './xp-celebration.service';

/**
 * Holds back the XP dialog for a session's entries until `done()` turns
 * true — one celebration on the done screen instead of one per set.
 * Leaving early still shows what was earned. Injection context only.
 */
export function holdXpUntilDone(
  done: () => boolean,
  sources: ReadonlyArray<string>
): void {
  const hold = inject(XpCelebrationService).hold(sources);
  effect(() => {
    if (done()) untracked(() => hold.release());
  });
  inject(DestroyRef).onDestroy(() => hold.release());
}
