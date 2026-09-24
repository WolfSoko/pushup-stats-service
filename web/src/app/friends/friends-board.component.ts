import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { EXERCISE_CATALOG } from '@pu-stats/models';
import { BusyDirective } from '@pu-stats/ui';

import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import { boardValueLabel } from './board-value-label';
import { CheerStore } from './cheer.store';
import type {
  FriendsBoardComparison,
  FriendsBoardEntry,
  FriendsBoardPeriod,
} from './friends-api.service';

/** The exercises one can race on: those counted in reps. */
const REP_EXERCISES = EXERCISE_CATALOG.filter(
  (exercise) => exercise.measurement === 'reps'
);

/**
 * The friends board: the same numbers as the public leaderboard, over a
 * group small enough that everyone appears — including the zeros, which
 * are the point on a day nobody trained.
 *
 * Each friend's row carries a cheer button: one tap a day, and the row
 * shows how many cheers they collected today. While a cheer is on its way
 * the button that was tapped shows a spinner — the send and the board
 * re-read behind it take long enough that a still icon reads as a tap
 * that missed.
 */
@Component({
  selector: 'app-friends-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
  ],
  template: `
    <mat-form-field
      appearance="outline"
      class="comparison"
      subscriptSizing="dynamic"
    >
      <mat-label i18n="@@friends.board.compare">Vergleich</mat-label>
      <mat-select
        [value]="comparisonKey()"
        (selectionChange)="changeComparison($event.value)"
        data-testid="board-comparison"
      >
        <mat-option value="days" i18n="@@friends.board.metric.days"
          >Trainingstage</mat-option
        >
        <mat-option value="streak" i18n="@@friends.board.metric.streak"
          >Streak</mat-option
        >
        <mat-option value="xp" i18n="@@friends.board.metric.xp"
          >XP (alle Übungen)</mat-option
        >
        <mat-optgroup>
          <span *matOptgroupLabel i18n="@@friends.board.metric.reps"
            >Wiederholungen</span
          >
          @for (exercise of repExercises; track exercise.id) {
            <mat-option [value]="'reps:' + exercise.id">{{
              exerciseName(exercise.id)
            }}</mat-option>
          }
        </mat-optgroup>
      </mat-select>
    </mat-form-field>
    @if (comparison().metric !== 'streak') {
      <mat-chip-listbox
        [value]="period()"
        (change)="periodChange.emit($event.value)"
        aria-label="Zeitraum"
        i18n-aria-label="@@friends.board.periodAria"
      >
        @if (comparison().metric !== 'days') {
          <mat-chip-option value="daily" i18n="@@friends.board.daily"
            >Heute</mat-chip-option
          >
        }
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
    }
    <ol class="board">
      @for (entry of entries(); track entry.uid; let i = $index) {
        <li [class.is-viewer]="entry.isViewer" data-testid="board-row">
          <span class="rank">{{ i + 1 }}</span>
          <a
            class="board-name"
            [routerLink]="['/u', entry.uid]"
            data-testid="board-name"
            >{{ label(entry) }}</a
          >
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
          <strong data-testid="board-value">{{ valueLabel(entry) }}</strong>
          <span class="cheer-slot">
            @if (!entry.isViewer) {
              <button
                mat-icon-button
                type="button"
                class="cheer-button"
                data-testid="board-cheer"
                [class.is-cheered]="isCheered(entry)"
                [disabled]="isCheered(entry)"
                [puBusy]="isCheering(entry.uid)"
                [attr.aria-label]="cheerLabel(entry)"
                [matTooltip]="cheerLabel(entry)"
                (click)="cheer.emit(entry.uid)"
              >
                <mat-icon>{{
                  isCheered(entry) ? 'local_fire_department' : 'whatshot'
                }}</mat-icon>
              </button>
            }
          </span>
        </li>
      }
    </ol>
  `,
  styleUrl: './friends-board.component.scss',
})
export class FriendsBoardComponent {
  readonly entries = input.required<ReadonlyArray<FriendsBoardEntry>>();
  readonly period = input.required<FriendsBoardPeriod>();
  readonly comparison = input.required<FriendsBoardComparison>();
  readonly periodChange = output<unknown>();
  readonly comparisonChange = output<FriendsBoardComparison>();
  readonly cheer = output<string>();
  /** The store's busy keys; a row spins while `cheer:<uid>` is among them. */
  readonly busyKeys = input<ReadonlySet<string>>(new Set());

  private readonly cheers = inject(CheerStore);

  protected readonly repExercises = REP_EXERCISES;

  /** The select's value: one key per choice, reps keyed by exercise. */
  protected readonly comparisonKey = computed(() => {
    const { metric, exerciseId } = this.comparison();
    return metric === 'reps' ? `reps:${exerciseId ?? ''}` : metric;
  });

  protected changeComparison(key: string): void {
    this.comparisonChange.emit(
      key.startsWith('reps:')
        ? { metric: 'reps', exerciseId: key.slice('reps:'.length) }
        : { metric: key === 'streak' || key === 'xp' ? key : 'days' }
    );
  }

  protected exerciseName(id: string): string {
    return exerciseDisplayName(id);
  }

  protected valueLabel(entry: FriendsBoardEntry): string {
    return boardValueLabel(this.comparison().metric, entry.value);
  }

  protected readonly cheerAria = $localize`:@@friends.board.cheer:Anfeuern`;
  protected readonly cheeredAria = $localize`:@@friends.board.cheered:Heute schon angefeuert`;
  protected readonly cheeringAria = $localize`:@@friends.board.cheering:Anfeuerung wird gesendet`;

  /** Also lit by a cheer sent from a challenge card since the board was read. */
  protected isCheered(entry: FriendsBoardEntry): boolean {
    return entry.cheered || this.cheers.hasCheered(entry.uid);
  }

  protected isCheering(uid: string): boolean {
    return this.busyKeys().has(`cheer:${uid}`);
  }

  /** What the button is doing, for the tooltip and for screen readers. */
  protected cheerLabel(entry: FriendsBoardEntry): string {
    if (this.isCheering(entry.uid)) return this.cheeringAria;
    return this.isCheered(entry) ? this.cheeredAria : this.cheerAria;
  }

  /** The viewer's own row says so, rather than repeating their name. */
  protected label(entry: FriendsBoardEntry): string {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }

  protected cheersLabel(count: number): string {
    return count === 1
      ? $localize`:@@friends.board.cheersTodayOne:Eine Anfeuerung heute`
      : $localize`:@@friends.board.cheersToday:${count}:count: Anfeuerungen heute`;
  }
}
