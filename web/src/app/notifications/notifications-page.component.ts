import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import type { InboxRow } from './inbox-rows';
import { NotificationItemComponent } from './notification-item.component';
import { NotificationStore } from './notification.store';

@Component({
  selector: 'app-notifications-page',
  imports: [MatButtonModule, NotificationItemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 i18n="@@notifications.page.title">Nachrichten</h1>
        @if (store.hasUnread()) {
          <button mat-button type="button" (click)="store.markAllRead()">
            <span i18n="@@notifications.page.markAll">Alle gelesen</span>
          </button>
        }
      </header>

      @for (row of store.rows(); track row.id) {
        <app-notification-item [row]="row" (open)="open($event)" />
      } @empty {
        <p class="empty" i18n="@@notifications.page.empty">
          Hier landen Anfeuerungen, Freundschaftsanfragen, Challenges und neue
          Abzeichen.
        </p>
      }
    </section>
  `,
  styles: `
    .page {
      max-width: 640px;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    h1 {
      margin: 0;
    }

    .empty {
      padding: 32px 8px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class NotificationsPageComponent {
  protected readonly store = inject(NotificationStore);
  private readonly router = inject(Router);

  protected async open(row: InboxRow): Promise<void> {
    await this.store.markRead(row);
    await this.router.navigateByUrl(row.url);
  }
}
