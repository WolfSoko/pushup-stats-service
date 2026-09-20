import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';

import type { InboxRow } from './inbox-rows';
import { NotificationItemComponent } from './notification-item.component';
import { NotificationStore } from './notification.store';

const PANEL_ROWS = 10;

@Component({
  selector: 'app-notification-bell',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatMenuModule,
    NotificationItemComponent,
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
              (click)="store.markAllRead()"
              i18n="@@notifications.panel.markAll"
            >
              Alle gelesen
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

        @for (row of visible(); track row.id) {
          <app-notification-item
            [row]="row"
            (open)="open($event)"
            (remove)="store.remove($event)"
          />
        } @empty {
          <p class="empty">{{ emptyText() }}</p>
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

    .filter {
      align-self: center;
      margin-bottom: 4px;
      --mat-standard-button-toggle-height: 30px;
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
    return this.store.visibleRows().slice(0, PANEL_ROWS);
  }

  /** "Nothing unread" and "nothing at all" are different news. */
  protected emptyText(): string {
    return this.store.inboxFilter() === 'unread' && this.store.hasAny()
      ? $localize`:@@notifications.empty.unread:Alles gelesen.`
      : $localize`:@@notifications.empty.all:Noch keine Nachrichten.`;
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
