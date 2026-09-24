import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BusyDirective, createBusyState } from '@pu-stats/ui';
import { AppUpdateStore } from './app-update.store';
import { PageReloadService } from './page-reload.service';

/**
 * Deliberately not a MatSnackBar: the snackbar is a singleton, so any
 * routine toast used to wipe the update notice for good.
 */
@Component({
  selector: 'app-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, BusyDirective],
  template: `
    @if (store.bannerVisible()) {
      <div
        class="app-update-banner"
        role="status"
        data-testid="app-update-banner"
      >
        <mat-icon aria-hidden="true">system_update</mat-icon>
        @if (store.status() === 'unrecoverable') {
          <span class="message" i18n="@@appUpdate.banner.unrecoverable"
            >App-Daten sind veraltet – bitte neu laden.</span
          >
        } @else {
          <span class="message" i18n="@@appUpdate.banner.ready"
            >Eine neue Version ist verfügbar.</span
          >
          <button
            mat-button
            type="button"
            data-testid="app-update-later"
            (click)="store.dismiss()"
            i18n="@@appUpdate.banner.later"
          >
            Später
          </button>
        }
        <button
          mat-flat-button
          type="button"
          data-testid="app-update-reload"
          [puBusy]="reloading.busy()"
          (click)="reload()"
          i18n="@@appUpdate.banner.reload"
        >
          Neu laden
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: sticky;
      top: var(--top-nav-height, 64px);
      z-index: 9;
    }
    .app-update-banner {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
      padding: 8px 16px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .message {
      flex: 1 1 12rem;
    }
  `,
})
export class AppUpdateBannerComponent {
  protected readonly store = inject(AppUpdateStore);
  private readonly reloader = inject(PageReloadService);
  protected readonly reloading = createBusyState();

  protected reload(): void {
    void this.reloading.run(() => this.reloader.reload());
  }
}
