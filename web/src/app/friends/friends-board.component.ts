import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';

import type {
  FriendsBoardEntry,
  FriendsBoardPeriod,
} from './friends-api.service';

/**
 * The friends board: the same numbers as the public leaderboard, over a
 * group small enough that everyone appears — including the zeros, which
 * are the point on a day nobody trained.
 */
@Component({
  selector: 'app-friends-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatChipsModule],
  template: `
    <mat-chip-listbox
      [value]="period()"
      (change)="periodChange.emit($event.value)"
      aria-label="Zeitraum"
      i18n-aria-label="@@friends.board.periodAria"
    >
      <mat-chip-option value="daily" i18n="@@friends.board.daily"
        >Heute</mat-chip-option
      >
      <mat-chip-option value="week" i18n="@@friends.board.week"
        >7 Tage</mat-chip-option
      >
      <mat-chip-option value="month" i18n="@@friends.board.month"
        >30 Tage</mat-chip-option
      >
      <mat-chip-option value="allTime" i18n="@@friends.board.allTime"
        >Gesamt</mat-chip-option
      >
    </mat-chip-listbox>
    <ol class="board">
      @for (entry of entries(); track entry.uid; let i = $index) {
        <li [class.is-viewer]="entry.isViewer" data-testid="board-row">
          <span class="rank">{{ i + 1 }}</span>
          <span class="board-name">{{ label(entry) }}</span>
          <strong>{{ entry.value }}</strong>
        </li>
      }
    </ol>
  `,
  styles: `
    .board {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .board li {
      display: grid;
      grid-template-columns: 2rem 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    :host-context(.dark-theme) .board li {
      background: rgba(255, 255, 255, 0.05);
    }
    .board li.is-viewer {
      outline: 2px solid var(--mat-sys-primary, #3f51b5);
    }
    .rank {
      opacity: 0.6;
      font-variant-numeric: tabular-nums;
    }
    .board-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class FriendsBoardComponent {
  readonly entries = input.required<ReadonlyArray<FriendsBoardEntry>>();
  readonly period = input.required<FriendsBoardPeriod>();
  readonly periodChange = output<unknown>();

  /** The viewer's own row says so, rather than repeating their name. */
  protected label(entry: FriendsBoardEntry): string {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }
}
