import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BusyDirective } from '@pu-stats/ui';

import { RelativeTimePipe } from './relative-time.pipe';
import type { InboxRow } from './inbox-rows';

@Component({
  selector: 'app-notification-item',
  imports: [MatButtonModule, MatIconModule, RelativeTimePipe, BusyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="row"
      [class.unread]="row().unread"
      [class.motivation]="row().category === 'motivation'"
    >
      <button
        type="button"
        class="main"
        [puBusy]="opening()"
        (click)="open.emit(row())"
      >
        <mat-icon>{{ row().icon }}</mat-icon>
        <span class="body">
          <span class="text">{{ row().text }}</span>
          @if (row().createdAt; as createdAt) {
            <span class="when">{{ createdAt | relativeTime }}</span>
          }
        </span>
      </button>

      @if (row().unread) {
        <span class="dot" aria-hidden="true"></span>
      }

      <!-- An announcement has no document behind it, so there is nothing
           to delete — its only state is "seen". -->
      @if (row().kind === 'notification') {
        <button
          mat-icon-button
          type="button"
          class="delete"
          [attr.aria-label]="deleteLabel"
          [puBusy]="removing()"
          (click)="remove.emit(row())"
        >
          <mat-icon>close</mat-icon>
        </button>
      }
    </div>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      padding: 2px 4px 2px 8px;
      border-radius: 10px;
    }

    .row:hover,
    .row:focus-within {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .main {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
      padding: 8px 4px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    /* A cheer or a reached goal is the same feeling as a motivational
       quote — it gets a card, not a grey list row. */
    .row.motivation {
      background: color-mix(in srgb, var(--mat-sys-tertiary) 14%, transparent);
      margin-block: 2px;
    }

    .row.motivation mat-icon {
      color: var(--mat-sys-tertiary);
    }

    .row.motivation .text {
      font-size: 1.02rem;
      font-weight: 600;
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .text {
      line-height: 1.3;
    }

    .when {
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--mat-sys-primary);
      flex: none;
    }

    .row:not(.unread) .text {
      color: var(--mat-sys-on-surface-variant);
    }

    .delete {
      flex: none;
      opacity: 0.55;
    }

    .row:hover .delete,
    .row:focus-within .delete {
      opacity: 1;
    }
  `,
})
export class NotificationItemComponent {
  readonly row = input.required<InboxRow>();
  readonly opening = input(false);
  readonly removing = input(false);
  readonly open = output<InboxRow>();
  readonly remove = output<InboxRow>();

  protected readonly deleteLabel = $localize`:@@notifications.item.delete:Nachricht löschen`;
}
