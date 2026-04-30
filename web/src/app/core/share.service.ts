import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

export type ShareResult = 'native' | 'clipboard' | 'cancelled' | 'unavailable';

type ShareCapableNavigator = Pick<Navigator, 'clipboard'> & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

const SNACKBAR_DEFAULTS = {
  horizontalPosition: 'center',
  verticalPosition: 'bottom',
} as const;

/**
 * Thin wrapper around the Web Share API with a clipboard fallback.
 *
 * Returns a discriminated tag so callers (or tests) can verify which path
 * actually ran without poking at globals. Snackbar feedback is centralised
 * here so every share entry-point shows consistent copy.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly snackBar = inject(MatSnackBar);

  async share(payload: SharePayload): Promise<ShareResult> {
    if (!isPlatformBrowser(this.platformId)) return 'unavailable';

    const nav = globalThis.navigator as ShareCapableNavigator | undefined;
    if (!nav) return 'unavailable';

    const data: ShareData = {
      title: payload.title,
      text: payload.text,
      url: payload.url,
    };

    if (typeof nav.share === 'function') {
      const supported =
        typeof nav.canShare === 'function' ? nav.canShare(data) : true;
      if (supported) {
        try {
          await nav.share(data);
          return 'native';
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return 'cancelled';
          }
        }
      }
    }

    return this.copyToClipboard(payload, nav);
  }

  private async copyToClipboard(
    payload: SharePayload,
    nav: ShareCapableNavigator
  ): Promise<ShareResult> {
    const clipboard = nav.clipboard;
    if (!clipboard?.writeText) {
      this.openSnackBar(
        $localize`:@@share.error.unavailable:Teilen ist auf diesem Gerät nicht möglich.`,
        4000
      );
      return 'unavailable';
    }

    try {
      await clipboard.writeText(`${payload.text} ${payload.url}`.trim());
      this.openSnackBar(
        $localize`:@@share.success.clipboard:In die Zwischenablage kopiert. Jetzt einfügen und teilen!`,
        3000
      );
      return 'clipboard';
    } catch {
      this.openSnackBar(
        $localize`:@@share.error.unavailable:Teilen ist auf diesem Gerät nicht möglich.`,
        4000
      );
      return 'unavailable';
    }
  }

  private openSnackBar(message: string, duration: number): void {
    this.snackBar.open(message, '', { duration, ...SNACKBAR_DEFAULTS });
  }
}
