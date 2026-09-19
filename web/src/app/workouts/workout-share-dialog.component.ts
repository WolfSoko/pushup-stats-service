import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule, MatListOption } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { MAX_WORKOUT_SHARE_RECIPIENTS } from '@pu-stats/models';

import { FriendsStore } from '../friends/friends.store';

/**
 * Pick the friends who get a copy. Closes with their uids; the page
 * sends them. Only confirmed friends are listed — the callable would
 * refuse anyone else, so the dialog does not offer them.
 */
@Component({
  selector: 'app-workout-share-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatListModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@workouts.share.title">
      Session an Freunde schicken
    </h2>
    <mat-dialog-content class="content">
      @if (friends.loading() && friends.friends().length === 0) {
        <mat-spinner diameter="28" />
      } @else if (friends.friends().length === 0) {
        <p i18n="@@workouts.share.noFriends">
          Du hast noch keine bestätigten Freunde. Lade jemanden ein — dann
          kannst du Sessions direkt teilen.
        </p>
        <a mat-stroked-button routerLink="/freunde" mat-dialog-close>
          <span i18n="@@workouts.share.toFriends">Zu den Freunden</span>
        </a>
      } @else {
        <p class="hint" i18n="@@workouts.share.hint">
          Jeder bekommt eine eigene Kopie, die er bearbeiten kann.
        </p>
        <mat-selection-list
          data-testid="workout-share-friends"
          (selectionChange)="
            selected.set(selectedUids($event.source.selectedOptions.selected))
          "
        >
          @for (friend of friends.friends(); track friend.uid) {
            <mat-list-option
              [value]="friend.uid"
              data-testid="workout-share-friend"
            >
              {{ friend.displayName ?? anonymous }}
            </mat-list-option>
          }
        </mat-selection-list>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        mat-dialog-close
        i18n="@@workouts.share.cancel"
      >
        Abbrechen
      </button>
      <button
        mat-flat-button
        type="button"
        data-testid="workout-share-submit"
        [disabled]="!valid()"
        (click)="submit()"
        i18n="@@workouts.share.submit"
      >
        Schicken
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
  `,
})
export class WorkoutShareDialogComponent implements OnInit {
  protected readonly friends = inject(FriendsStore);
  private readonly dialogRef = inject(
    MatDialogRef<WorkoutShareDialogComponent, string[]>
  );

  protected readonly anonymous = $localize`:@@friends.anonymous:Ohne Namen`;
  protected readonly selected = signal<string[]>([]);

  protected readonly valid = computed(
    () =>
      this.selected().length > 0 &&
      this.selected().length <= MAX_WORKOUT_SHARE_RECIPIENTS
  );

  ngOnInit(): void {
    void this.friends.reload();
  }

  protected selectedUids(options: MatListOption[]): string[] {
    return options.map((option) => String(option.value));
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.dialogRef.close(this.selected());
  }
}
