import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { isDashboard, routerUrl } from '../feature-announcement.service';
import { InstallPromptService } from '../install-prompt.service';
import { UserConfigStore } from '../user-config.store';
import {
  installSuggestionVariant,
  type InstallSuggestionResult,
  type InstallSuggestionVariant,
  isSnoozed,
  snooze,
} from './install-suggestion';

export const INSTALL_SUGGESTION_DELAY_MS = 20_000;

/**
 * Suggests installing the app once per session on the dashboard: the Play
 * Store app on Android, the browser's PWA install elsewhere, the
 * home-screen steps on iOS. Stays silent inside the installed app, while
 * another dialog is open, and for the snooze window after an answer.
 *
 * The countdown starts only once the user config has loaded — the "what's
 * new" walkthrough and the Android test invite open on that same signal,
 * and none of them check for open dialogs, so they get to go first and
 * the suggestion skips the session instead of stacking on top.
 *
 * Inject once in the app root, like `FeatureAnnouncementService`.
 */
@Injectable({ providedIn: 'root' })
export class InstallSuggestionOrchestrationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly userConfig = inject(UserConfigStore);
  private readonly url = routerUrl(inject(Router));

  private shown = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly _effect = effect(() => {
    // Read the signals before any early return: a run that bails out on
    // the pending timer would otherwise drop them as dependencies and
    // never wake up for the next dashboard visit.
    const onDashboard = isDashboard(this.url());
    const variant = this.variant();
    const configLoaded = this.userConfig.loaded();
    if (!isPlatformBrowser(this.platformId) || this.shown || this.timer) {
      return;
    }
    if (!onDashboard || !variant || !configLoaded) return;
    if (isSnoozed(this.storage(), new Date())) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.suggest();
    }, INSTALL_SUGGESTION_DELAY_MS);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  private variant(): InstallSuggestionVariant | null {
    return installSuggestionVariant({
      isInstalled: this.installPrompt.isStandalone(),
      isAndroid: this.installPrompt.isAndroid,
      isIos: this.installPrompt.isIos,
      canInstallPwa: this.installPrompt.canInstall(),
    });
  }

  private async suggest(): Promise<void> {
    const variant = this.variant();
    if (!variant || !isDashboard(this.url())) return;
    if (
      this.dialog.openDialogs.length > 0 ||
      isSnoozed(this.storage(), new Date())
    ) {
      this.shown = true;
      return;
    }
    this.shown = true;
    if (
      variant === 'play-store' &&
      (await this.installPrompt.hasInstalledAndroidApp())
    ) {
      snooze(this.storage(), 'installing', new Date());
      return;
    }

    const { InstallSuggestionDialogComponent } =
      await import('./install-suggestion-dialog.component');
    const ref = this.dialog.open<unknown, unknown, InstallSuggestionResult>(
      InstallSuggestionDialogComponent,
      {
        data: { variant },
        width: 'min(92vw, 440px)',
        maxWidth: '92vw',
        autoFocus: 'dialog',
      }
    );
    ref.afterClosed().subscribe((result) => {
      snooze(this.storage(), result ?? 'dismissed', new Date());
    });
  }

  private storage(): Storage | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }
}
