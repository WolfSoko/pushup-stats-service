import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { UserConfigStore } from './user-config.store';

/**
 * Announcements a signed-in user gets once, keyed by id. An id is
 * persisted to `ui.seenAnnouncements` when its dialog closes, so the
 * walkthrough follows the account, not the device. Add a new feature
 * here with a fresh id; ids never get reused.
 */
export const WORKOUTS_ANNOUNCEMENT = 'workouts-2026-09';

/**
 * Opens the "what's new" walkthrough on the dashboard, once, for a user
 * who has not seen it. Waits for the dashboard rather than firing on the
 * first page after login: a dialog over the login or register form, or
 * over a shared profile the user just landed on, would interrupt what
 * they came for.
 *
 * Inject once in the app root, like `AndroidTestInviteOrchestrationService`.
 */
@Injectable({ providedIn: 'root' })
export class FeatureAnnouncementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly userConfig = inject(UserConfigStore);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private shown = false;

  private readonly _effect = effect(() => {
    if (!isPlatformBrowser(this.platformId) || this.shown) return;
    const config = this.userConfig.config();
    const url = this.url();
    if (!config || !isDashboard(url)) return;
    if (config.ui?.seenAnnouncements?.includes(WORKOUTS_ANNOUNCEMENT)) return;

    this.shown = true;
    void this.open();
  });

  private async open(): Promise<void> {
    const { WorkoutsIntroDialogComponent } =
      await import('../workouts/workouts-intro-dialog.component');
    const ref = this.dialog.open(WorkoutsIntroDialogComponent, {
      width: 'min(92vw, 440px)',
      maxWidth: '92vw',
      autoFocus: 'dialog',
    });
    ref.afterClosed().subscribe(() => {
      void this.userConfig
        .markAnnouncementSeen(WORKOUTS_ANNOUNCEMENT)
        .catch(() => undefined);
    });
  }
}

/** `/app`, with or without a locale prefix or query string. */
export function isDashboard(url: string): boolean {
  return /^(\/[a-z]{2})?\/app(\/|\?|#|$)/.test(url);
}
