import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import {
  CHALLENGE_DURATIONS_DAYS,
  challengeRejection,
  EXERCISE_CATALOG,
  MAX_CHALLENGE_TARGET,
  MIN_CHALLENGE_TARGET,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type ChallengeDurationDays,
} from '@pu-stats/models';

import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import type { CreateChallengeInput } from './challenges-api.service';
import type { FriendRow } from './friends-api.service';

export interface ChallengeCreateDialogData {
  readonly friends: ReadonlyArray<FriendRow>;
}

/**
 * "Start a challenge": pick friends, an exercise, a target and a
 * duration. The dialog closes with a `CreateChallengeInput`; the page
 * sends it. Validation mirrors the callable's, so a refusal here is one
 * the server would have given too.
 */
@Component({
  selector: 'app-challenge-create-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@challenge.create.title">Challenge starten</h2>
    <mat-dialog-content class="content">
      <p class="hint" i18n="@@challenge.create.friendsHint">Wer macht mit?</p>
      <mat-selection-list
        data-testid="challenge-friends"
        (selectionChange)="
          selected.set(selectedUids($event.source.selectedOptions.selected))
        "
      >
        @for (friend of data.friends; track friend.uid) {
          <mat-list-option [value]="friend.uid" data-testid="challenge-friend">
            {{ friend.displayName ?? anonymous }}
          </mat-list-option>
        }
      </mat-selection-list>

      <mat-form-field appearance="outline" class="field">
        <mat-label i18n="@@challenge.create.exercise">Übung</mat-label>
        <mat-select
          [value]="exerciseId()"
          (valueChange)="exerciseId.set($event)"
        >
          @for (option of exercises; track option.id) {
            <mat-option [value]="option.id">{{ option.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="field">
        <mat-label i18n="@@challenge.create.target"
          >Ziel (Wiederholungen)</mat-label
        >
        <input
          matInput
          type="number"
          inputmode="numeric"
          data-testid="challenge-target"
          [min]="minTarget"
          [max]="maxTarget"
          [value]="target()"
          (input)="target.set(toNumber($event))"
        />
      </mat-form-field>

      <mat-form-field appearance="outline" class="field">
        <mat-label i18n="@@challenge.create.duration">Dauer</mat-label>
        <mat-select [value]="days()" (valueChange)="days.set($event)">
          @for (option of durations; track option) {
            <mat-option [value]="option">{{
              durationLabel(option)
            }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        mat-dialog-close
        i18n="@@challenge.create.cancel"
      >
        Abbrechen
      </button>
      <button
        mat-flat-button
        type="button"
        data-testid="challenge-submit"
        [disabled]="!valid()"
        (click)="submit()"
        i18n="@@challenge.create.submit"
      >
        Los geht’s
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: grid;
      gap: 8px;
      min-width: min(80vw, 360px);
    }
    .hint {
      margin: 0;
      opacity: 0.8;
    }
    .field {
      width: 100%;
    }
  `,
})
export class ChallengeCreateDialogComponent {
  protected readonly data = inject<ChallengeCreateDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<ChallengeCreateDialogComponent, CreateChallengeInput>>(
      MatDialogRef
    );

  protected readonly anonymous = $localize`:@@friends.anonymous:Ohne Namen`;
  protected readonly minTarget = MIN_CHALLENGE_TARGET;
  protected readonly maxTarget = MAX_CHALLENGE_TARGET;
  protected readonly durations = CHALLENGE_DURATIONS_DAYS;
  /** Only counted exercises: a challenge sums reps. */
  protected readonly exercises = EXERCISE_CATALOG.filter(
    (exercise) => exercise.measurement === 'reps'
  ).map((exercise) => ({
    id: exercise.id,
    label: exerciseDisplayName(exercise.id),
  }));

  protected readonly selected = signal<ReadonlyArray<string>>([]);
  protected readonly exerciseId = signal<string>(PUSHUP_QUICK_ADD_EXERCISE_ID);
  protected readonly target = signal<number>(500);
  protected readonly days = signal<ChallengeDurationDays>(7);

  protected readonly valid = computed(
    () =>
      challengeRejection({
        friendUids: [...this.selected()],
        acceptedFriendUids: this.data.friends.map((f) => f.uid),
        target: this.target(),
        days: this.days(),
        exerciseValid: this.exercises.some((e) => e.id === this.exerciseId()),
        activeCount: 0,
      }) === null
  );

  protected selectedUids(options: ReadonlyArray<{ value: unknown }>): string[] {
    return options.map((option) => String(option.value));
  }

  protected toNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected durationLabel(days: number): string {
    return $localize`:@@challenge.create.days:${days}:days: Tage`;
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.ref.close({
      friendUids: [...this.selected()],
      exerciseId: this.exerciseId(),
      exerciseName: exerciseDisplayName(this.exerciseId()),
      target: this.target(),
      days: this.days(),
    });
  }
}
