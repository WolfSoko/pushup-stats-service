import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Router } from '@angular/router';
import { BusyDirective } from '@pu-stats/ui';

import type { InboxRow } from './inbox-rows';
import { NotificationItemComponent } from './notification-item.component';
import { NotificationStore } from './notification.store';

@Component({
  selector: 'app-notifications-page',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    NotificationItemComponent,
    BusyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header>
        <h1 i18n="@@notifications.page.title">Nachrichten</h1>
        @if (store.hasUnread()) {
          <button
            mat-button
            type="button"
            data-testid="notifications-mark-all"
            [puBusy]="store.markingAllRead.busy()"
            (click)="store.markAllRead()"
          >
            <span i18n="@@notifications.page.markAll">Alle gelesen</span>
          </button>
        }
      </header>

      <mat-button-toggle-group
        class="filter"
        [value]="store.inboxFilter()"
        (change)="store.setFilter($event.value)"
        [hideSingleSelectionIndicator]="true"
      >
        <mat-button-toggle value="unread" i18n="@@notifications.filter.unread"
          >Ungelesen</mat-button-toggle
        >
        <mat-button-toggle value="all" i18n="@@notifications.filter.all"
          >Alle</mat-button-toggle
        >
      </mat-button-toggle-group>

      @for (row of store.visibleRows(); track row.id) {
        <app-notification-item
          [row]="row"
          [opening]="store.rowBusy.isBusy('open:' + row.id)"
          [removing]="store.rowBusy.isBusy('remove:' + row.id)"
          (open)="open($event)"
          (remove)="store.remove($event)"
        />
      } @empty {
        @if (store.inboxFilter() === 'unread' && store.hasAny()) {
          <p class="empty" i18n="@@notifications.page.allRead">
            Alles gelesen. Über „Alle“ siehst du auch ältere Nachrichten.
          </p>
        } @else {
          <p class="empty" i18n="@@notifications.page.empty">
            Hier landen Anfeuerungen, Freundschaftsanfragen, Challenges und neue
            Abzeichen.
          </p>
        }
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

    .filter {
      align-self: flex-start;
      margin-bottom: 8px;
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
