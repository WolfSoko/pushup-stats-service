import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { challengeDaysLeft, challengePercent } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';
import { firstValueFrom } from 'rxjs';

import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import type { ChallengeEntry, ChallengeView } from './challenges-api.service';
import { ChallengesStore } from './challenges.store';
import type { FriendRow } from './friends-api.service';
import { challengeRejectionMessage } from './friends-messages';

/**
 * The challenges block on the friends screen: what is running, how far
 * everyone is, and the button that starts a new one. The dialog is
 * dynamic-imported so the friends page stays light for people who never
 * open it.
 */
@Component({
  selector: 'app-challenges-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="section-head">
      <h2 i18n="@@challenges.title">Challenges</h2>
      <button
        mat-flat-button
        type="button"
        data-testid="challenge-start"
        [disabled]="friends().length === 0"
        (click)="start()"
      >
        <mat-icon>flag</mat-icon>
        <span i18n="@@challenges.start">Challenge starten</span>
      </button>
    </div>

    @if (rejection(); as message) {
      <mat-card class="challenge-error">
        <mat-card-content>
          <mat-icon aria-hidden="true">info</mat-icon>
          <span>{{ message }}</span>
        </mat-card-content>
      </mat-card>
    }

    @if (store.challenges().length === 0) {
      <p class="muted" i18n="@@challenges.empty">
        Noch keine Challenge. Fordere deine Freunde heraus: ein Ziel, ein paar
        Tage, alle zusammen.
      </p>
    }

    @for (challenge of store.challenges(); track challenge.id) {
      <mat-card
        class="challenge-card"
        data-testid="challenge-card"
        [class.is-ended]="challenge.status === 'ended'"
      >
        <mat-card-header>
          <mat-card-title>
            {{ challenge.target }} {{ exerciseLabel(challenge.exerciseId) }}
          </mat-card-title>
          <mat-card-subtitle data-testid="challenge-meta">
            @if (challenge.status === 'ended') {
              <ng-container i18n="@@challenges.ended">Beendet</ng-container>
            } @else {
              {{ daysLeftLabel(challenge) }}
            }
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @for (entry of challenge.entries; track entry.uid) {
            <div
              class="participant"
              [class.is-viewer]="entry.isViewer"
              data-testid="challenge-participant"
            >
              <span class="participant-name">{{ label(entry) }}</span>
              <span class="participant-value"
                >{{ entry.value }} / {{ challenge.target }}</span
              >
              <mat-progress-bar
                mode="determinate"
                [value]="percent(entry, challenge)"
              />
            </div>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <button
            mat-button
            type="button"
            data-testid="challenge-leave"
            (click)="store.leave(challenge.id)"
            i18n="@@challenges.leave"
          >
            Verlassen
          </button>
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: `
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    h2 {
      margin: 8px 0;
      font-size: 1.1rem;
    }
    .challenge-card {
      margin-bottom: 8px;
    }
    .challenge-card.is-ended {
      opacity: 0.75;
    }
    .participant {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px 8px;
      padding: 6px 0;
    }
    .participant mat-progress-bar {
      grid-column: 1 / -1;
    }
    .participant.is-viewer .participant-name {
      font-weight: 600;
    }
    .participant-value {
      font-variant-numeric: tabular-nums;
      opacity: 0.85;
    }
    .challenge-error mat-card-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .muted {
      opacity: 0.7;
    }
  `,
})
export class ChallengesSectionComponent {
  protected readonly store = inject(ChallengesStore);
  private readonly dialog = inject(MatDialog);

  /** Confirmed friends — the people a new challenge can invite. */
  readonly friends = input.required<ReadonlyArray<FriendRow>>();

  protected readonly rejection = computed(() =>
    challengeRejectionMessage(this.store.lastRejection())
  );

  protected exerciseLabel(exerciseId: string): string {
    return exerciseDisplayName(exerciseId);
  }

  protected label(entry: ChallengeEntry): string {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }

  protected percent(entry: ChallengeEntry, challenge: ChallengeView): number {
    return challengePercent(entry.value, challenge.target);
  }

  protected daysLeftLabel(challenge: ChallengeView): string {
    const days = challengeDaysLeft(challenge, toBerlinIsoDate(new Date()));
    return days === 1
      ? $localize`:@@challenges.lastDay:Letzter Tag`
      : $localize`:@@challenges.daysLeft:Noch ${days}:days: Tage`;
  }

  protected async start(): Promise<void> {
    const { ChallengeCreateDialogComponent } =
      await import('./challenge-create-dialog.component');
    const ref = this.dialog.open(ChallengeCreateDialogComponent, {
      data: { friends: this.friends() },
      autoFocus: 'dialog',
    });
    const input = await firstValueFrom(ref.afterClosed());
    if (input) await this.store.create(input);
  }
}
