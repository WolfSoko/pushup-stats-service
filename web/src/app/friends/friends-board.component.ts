import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import type {
  FriendsBoardEntry,
  FriendsBoardPeriod,
} from './friends-api.service';

/**
 * The friends board: the same numbers as the public leaderboard, over a
 * group small enough that everyone appears — including the zeros, which
 * are the point on a day nobody trained.
 *
 * Each friend's row carries a cheer button: one tap a day, and the row
 * shows how many cheers they collected today.
 */
@Component({
  selector: 'app-friends-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatChipsModule, MatIconModule, MatTooltipModule],
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
          <span class="cheers">
            @if (entry.cheers > 0) {
              <span
                data-testid="board-cheers"
                [attr.aria-label]="cheersLabel(entry.cheers)"
                [matTooltip]="cheersLabel(entry.cheers)"
                >🔥 {{ entry.cheers }}</span
              >
            }
          </span>
          <strong>{{ entry.value }}</strong>
          <span class="cheer-slot">
            @if (!entry.isViewer) {
              <button
                mat-icon-button
                type="button"
                class="cheer-button"
                data-testid="board-cheer"
                [class.is-cheered]="entry.cheered"
                [disabled]="entry.cheered"
                [attr.aria-label]="entry.cheered ? cheeredAria : cheerAria"
                [matTooltip]="entry.cheered ? cheeredAria : cheerAria"
                (click)="cheer.emit(entry.uid)"
              >
                <mat-icon>{{
                  entry.cheered ? 'local_fire_department' : 'whatshot'
                }}</mat-icon>
              </button>
            }
          </span>
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
      grid-template-columns: 2rem 1fr auto auto 40px;
      align-items: center;
      gap: 8px;
      padding: 4px 4px 4px 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
      min-height: 48px;
    }
    :host-context(.dark-theme) .board li {
      background: rgba(255, 255, 255, 0.05);
    }
    .board li.is-viewer {
      outline: 2px solid var(--mat-sys-primary, #3f51b5);
    }
    .cheer-slot {
      display: inline-flex;
      justify-content: center;
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
    .cheers {
      font-size: 0.85rem;
      opacity: 0.85;
      white-space: nowrap;
    }
    .cheer-button.is-cheered {
      color: var(--mat-sys-tertiary, #ff7043);
    }
  `,
})
export class FriendsBoardComponent {
  readonly entries = input.required<ReadonlyArray<FriendsBoardEntry>>();
  readonly period = input.required<FriendsBoardPeriod>();
  readonly periodChange = output<unknown>();
  readonly cheer = output<string>();

  protected readonly cheerAria = $localize`:@@friends.board.cheer:Anfeuern`;
  protected readonly cheeredAria = $localize`:@@friends.board.cheered:Heute schon angefeuert`;

  /** The viewer's own row says so, rather than repeating their name. */
  protected label(entry: FriendsBoardEntry): string {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }

  protected cheersLabel(count: number): string {
    return $localize`:@@friends.board.cheersToday:${count}:count: Anfeuerungen heute`;
  }
}
