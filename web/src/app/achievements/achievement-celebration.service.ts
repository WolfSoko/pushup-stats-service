import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { UserAchievementsApiService } from '@pu-stats/data-access';

import { UserContextService } from '@pu-auth/auth';
import { resolveAchievementBadge } from '../public-profile/achievement-badge';
import {
  markCelebrated,
  pendingCelebrations,
  readCelebrated,
} from './achievement-celebration';
import {
  AchievementDialogComponent,
  type AchievementDialogData,
} from './achievement-dialog.component';

const SHARE_URL = 'https://pushup-stats.com';

/**
 * Opens a celebration dialog the first time the user sees a badge.
 *
 * Awarding runs server-side in a Firestore trigger, so the client cannot
 * detect the moment itself — it watches `userAchievements/{uid}` and
 * reacts whenever the document syncs. That can be minutes later or on
 * the next visit, which is precisely why the "already celebrated" set is
 * persisted rather than kept in memory.
 *
 * One dialog at a time: earning two badges in one write (a plan's last
 * day can complete both a milestone and the plan) should not stack two
 * modals on top of each other. The rest are marked as seen — they remain
 * visible on the profile.
 */
@Injectable({ providedIn: 'root' })
export class AchievementCelebrationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly api = inject(UserAchievementsApiService);
  private readonly user = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.start();
  }

  private start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const userId = this.user.userIdSafe();
    if (!userId) return;

    this.api
      .watchEarned(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((earned) => this.handle(earned));
  }

  private handle(
    earned: ReadonlyArray<{ id: string; awardedAt: string }>
  ): void {
    const pending = pendingCelebrations(earned, readCelebrated());
    if (pending.length === 0) return;

    // Mark everything seen up front: if the dialog is dismissed by a
    // reload rather than a click, the user should not be greeted by the
    // same badge on every visit.
    markCelebrated(pending);

    const badge = pending
      .map(resolveAchievementBadge)
      .find((entry) => entry !== null);
    if (!badge) return;

    this.dialog.open(AchievementDialogComponent, {
      data: { badge, shareUrl: SHARE_URL } satisfies AchievementDialogData,
      autoFocus: 'dialog',
    });
  }
}
