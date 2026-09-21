import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { BusyDirective } from '@pu-stats/ui';

import type { InboxRow } from './inbox-rows';
import { NotificationItemComponent } from './notification-item.component';
import { NotificationStore } from './notification.store';

const PANEL_ROWS = 10;

@Component({
  selector: 'app-notification-bell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    NotificationItemComponent,
    BusyDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="ariaLabel()"
      data-testid="notification-bell"
    >
      <span class="bell">
        <mat-icon>{{
          store.hasUnread() ? 'notifications_active' : 'notifications'
        }}</mat-icon>
        @if (store.unreadCount(); as count) {
          <span class="badge" data-testid="notification-badge">{{
            count > 9 ? '9+' : count
          }}</span>
        }
      </span>
    </button>

    <mat-menu #menu="matMenu" class="notification-panel">
      <div class="panel" (click)="$event.stopPropagation()">
        <header>
          <span i18n="@@notifications.panel.title">Nachrichten</span>
          @if (store.hasUnread()) {
            <button
              mat-button
              type="button"
              data-testid="notification-panel-mark-all"
              [puBusy]="store.markingAllRead.busy()"
              (click)="store.markAllRead()"
              i18n="@@notifications.panel.markAll"
            >
              Alle gelesen
            </button>
          }
        </header>

        @for (row of visible(); track row.id) {
          <app-notification-item
            [row]="row"
            [opening]="store.rowBusy.isBusy('open:' + row.id)"
            [removing]="store.rowBusy.isBusy('remove:' + row.id)"
            (open)="open($event)"
            (remove)="store.remove($event)"
          />
        } @empty {
          <p class="empty" i18n="@@notifications.panel.allRead">
            Alles gelesen.
          </p>
        }

        <button
          mat-button
          type="button"
          class="all"
          (click)="goToAll()"
          i18n="@@notifications.panel.showAll"
        >
          Alle anzeigen
        </button>
      </div>
    </mat-menu>
  `,
  styles: `
    .bell {
      position: relative;
      display: inline-flex;
    }

    .badge {
      position: absolute;
      top: -4px;
      inset-inline-end: -6px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font-size: 0.65rem;
      line-height: 16px;
      text-align: center;
      font-weight: 600;
    }

    .panel {
      width: min(92vw, 360px);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 8px 8px;
      font-weight: 600;
    }

    .empty {
      margin: 0;
      padding: 16px 8px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .all {
      align-self: center;
    }
  `,
})
export class NotificationBellComponent {
  protected readonly store = inject(NotificationStore);
  private readonly router = inject(Router);

  protected visible(): ReadonlyArray<InboxRow> {
    return this.store.unreadRows().slice(0, PANEL_ROWS);
  }

  protected ariaLabel(): string {
    const count = this.store.unreadCount();
    return count === 0
      ? $localize`:@@notifications.bell.none:Nachrichten`
      : $localize`:@@notifications.bell.unread:Nachrichten, ${count}:count: ungelesen`;
  }

  protected async open(row: InboxRow): Promise<void> {
    await this.store.markRead(row);
    await this.router.navigateByUrl(row.url);
  }

  protected async goToAll(): Promise<void> {
    await this.router.navigateByUrl('/nachrichten');
  }
}
