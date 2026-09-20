import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { RelativeTimePipe } from './relative-time.pipe';
import type { InboxRow } from './inbox-rows';

@Component({
  selector: 'app-notification-item',
  imports: [MatIconModule, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="row"
      [class.unread]="row().unread"
      [class.motivation]="row().category === 'motivation'"
      (click)="open.emit(row())"
    >
      <mat-icon>{{ row().icon }}</mat-icon>
      <span class="body">
        <span class="text">{{ row().text }}</span>
        @if (row().createdAt; as createdAt) {
          <span class="when">{{ createdAt | relativeTime }}</span>
        }
      </span>
      @if (row().unread) {
        <span class="dot" aria-hidden="true"></span>
      }
    </button>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    .row:hover,
    .row:focus-visible {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
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
  `,
})
export class NotificationItemComponent {
  readonly row = input.required<InboxRow>();
  readonly open = output<InboxRow>();
}
