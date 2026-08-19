import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { isAndroidDevice, isRunningInTwa } from './android-platform';
import { AndroidTestInviteDialogComponent } from './android-test-invite-dialog.component';
import { UserConfigStore } from './user-config.store';

/**
 * Opens the Android closed-test invite popup once per app session for a
 * user who: is on an Android device, isn't already running inside the
 * installed TWA, has been admin-confirmed as a candidate
 * (`androidTest.status === 'confirmed'`), and hasn't recently dismissed the
 * popup (`ui.androidTestPopupDismissedUntil` in the future).
 *
 * Inject once (e.g. in App root, alongside `ReminderOrchestrationService`)
 * to activate — mirrors that service's "app root delegation" pattern.
 */
@Injectable({ providedIn: 'root' })
export class AndroidTestInviteOrchestrationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly userConfig = inject(UserConfigStore);

  private shown = false;

  private readonly _effect = effect(() => {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.shown) return;

    const config = this.userConfig.config();
    if (config?.androidTest?.status !== 'confirmed') return;

    const dismissedUntil = config.ui?.androidTestPopupDismissedUntil;
    if (dismissedUntil && dismissedUntil > new Date().toISOString()) return;

    if (!isAndroidDevice(navigator.userAgent)) return;
    if (isRunningInTwa(document.referrer)) return;

    this.shown = true;
    this.dialog.open(AndroidTestInviteDialogComponent, {
      width: 'min(92vw, 420px)',
      maxWidth: '92vw',
    });
  });
}
