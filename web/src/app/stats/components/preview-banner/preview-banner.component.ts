import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@pu-auth/auth';

@Component({
  selector: 'app-preview-banner',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    @if (show()) {
      <div class="preview-banner" role="banner">
        <div class="preview-banner__text">
          <mat-icon>visibility</mat-icon>
          <span i18n="@@previewBanner.text"
            >Demo-Ansicht – Starte jetzt und zeichne deine eigenen Pushups
            auf</span
          >
        </div>
        <a mat-flat-button routerLink="/register" i18n="@@previewBanner.cta">
          Jetzt starten
        </a>
      </div>
    }
  `,
  styles: `
    .preview-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      background: var(--mat-sys-primary-container, #e8def8);
      color: var(--mat-sys-on-primary-container, #1d192b);
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .preview-banner__text {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewBannerComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthStore);

  readonly show = computed(
    () => isPlatformBrowser(this.platformId) && this.auth.isGuest()
  );
}
