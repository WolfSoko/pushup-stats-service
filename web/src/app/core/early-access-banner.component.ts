import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const DISMISSED_KEY = 'pus_early_access_dismissed';

@Component({
  selector: 'app-early-access-banner',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (visible()) {
      <div class="early-access-banner" role="banner">
        <div class="early-access-banner__text">
          <mat-icon>science</mat-icon>
          <span i18n="@@earlyAccess.text"
            >Early Access – pushup-stats.de befindet sich noch im Aufbau.
            Funktionen und Design können sich jederzeit ändern.</span
          >
        </div>
        <button
          mat-icon-button
          type="button"
          (click)="dismiss()"
          aria-label="Banner schließen"
          i18n-aria-label="@@earlyAccess.dismiss"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
  `,
  styles: `
    .early-access-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: var(--mat-sys-tertiary-container, #ffd8e4);
      color: var(--mat-sys-on-tertiary-container, #31111d);
      padding: 8px 16px;
      font-size: 0.85rem;
    }

    .early-access-banner__text {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EarlyAccessBannerComponent {
  private readonly platformId = inject(PLATFORM_ID);
  readonly visible = signal(!this.isDismissed());

  dismiss(): void {
    this.visible.set(false);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // localStorage unavailable
    }
  }

  private isDismissed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
