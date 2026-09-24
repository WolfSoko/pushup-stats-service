import { DestroyRef, effect, inject, untracked } from '@angular/core';

import { XpCelebrationService } from '../../core/xp/xp-celebration.service';
import type { SessionCaptureService } from './session-capture.service';
import type { SessionPhase } from './training-session.store';

/**
 * One XP dialog for the whole session, on the done screen — a dialog per
 * step would sit between every set. Entries the plan store writes for the
 * session (a closing round) are held back too. Leaving early still shows
 * what was earned. Must run in an injection context.
 */
export function celebrateSessionXpOnDone(
  phase: () => SessionPhase,
  capture: Pick<SessionCaptureService, 'takeSaved'>
): void {
  const celebration = inject(XpCelebrationService);
  const hold = celebration.hold();
  const flush = () => {
    const entries = [...capture.takeSaved(), ...hold.take()];
    hold.release();
    if (entries.length > 0) celebration.celebrate(entries);
  };
  effect(() => {
    if (phase() === 'done') untracked(flush);
  });
  inject(DestroyRef).onDestroy(flush);
}
