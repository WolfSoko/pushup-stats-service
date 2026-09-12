import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { challengeDaysLeft, challengePercent } from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';

import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import type { ChallengeEntry, ChallengeView } from './challenges-api.service';

/**
 * One challenge. An invitee sees what it is and answers; a participant
 * sees everyone's progress and may leave.
 */
@Component({
  selector: 'app-challenge-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <mat-card
      class="challenge-card"
      data-testid="challenge-card"
      [class.is-ended]="challenge().status === 'ended'"
      [class.is-invitation]="challenge().viewerInvited"
    >
      <mat-card-header>
        <mat-card-title>
          {{ challenge().target }} {{ exerciseLabel() }}
        </mat-card-title>
        <mat-card-subtitle data-testid="challenge-meta">
          @if (challenge().status === 'ended') {
            <ng-container i18n="@@challenges.ended">Beendet</ng-container>
          } @else {
            {{ daysLeftLabel() }}
          }
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (challenge().viewerInvited) {
          <p data-testid="challenge-invitation" i18n="@@challenges.invitation">
            Du bist eingeladen. Nimmst du an, sehen die Teilnehmer deine
            Wiederholungen dieser Übung im Challenge-Zeitraum – und du ihre.
          </p>
        } @else {
          @for (entry of challenge().entries; track entry.uid) {
            <div
              class="participant"
              [class.is-viewer]="entry.isViewer"
              data-testid="challenge-participant"
            >
              <span class="participant-name">{{ label(entry) }}</span>
              <span class="participant-value"
                >{{ entry.value }} / {{ challenge().target }}</span
              >
              <mat-progress-bar mode="determinate" [value]="percent(entry)" />
            </div>
          }
          @if (invitedNames(); as names) {
            <p class="muted" data-testid="challenge-invited">
              <span i18n="@@challenges.stillInvited">Noch eingeladen:</span>
              {{ names }}
            </p>
          }
        }
      </mat-card-content>
      <mat-card-actions align="end">
        @if (challenge().viewerInvited) {
          <button
            mat-stroked-button
            type="button"
            data-testid="challenge-decline"
            (click)="decline.emit(challenge().id)"
            i18n="@@challenges.decline"
          >
            Ablehnen
          </button>
          <button
            mat-flat-button
            type="button"
            data-testid="challenge-accept"
            [disabled]="challenge().status === 'ended'"
            (click)="accept.emit(challenge().id)"
            i18n="@@challenges.accept"
          >
            Mitmachen
          </button>
        } @else {
          <button
            mat-button
            type="button"
            data-testid="challenge-leave"
            (click)="leave.emit(challenge().id)"
            i18n="@@challenges.leave"
          >
            Verlassen
          </button>
        }
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .challenge-card {
      margin-bottom: 8px;
    }
    .challenge-card.is-ended {
      opacity: 0.75;
    }
    .challenge-card.is-invitation {
      outline: 2px solid var(--mat-sys-primary, #3f51b5);
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
    .muted {
      opacity: 0.7;
      margin: 8px 0 0;
    }
    mat-card-actions {
      gap: 8px;
    }
  `,
})
export class ChallengeCardComponent {
  readonly challenge = input.required<ChallengeView>();
  readonly accept = output<string>();
  readonly decline = output<string>();
  readonly leave = output<string>();

  protected readonly exerciseLabel = computed(() =>
    exerciseDisplayName(this.challenge().exerciseId)
  );

  protected readonly invitedNames = computed(() => {
    const names = this.challenge().invited.map(
      (invitee) => invitee.displayName ?? this.anonymous
    );
    return names.length > 0 ? names.join(', ') : null;
  });

  protected readonly daysLeftLabel = computed(() => {
    const days = challengeDaysLeft(
      this.challenge(),
      toBerlinIsoDate(new Date())
    );
    return days === 1
      ? $localize`:@@challenges.lastDay:Letzter Tag`
      : $localize`:@@challenges.daysLeft:Noch ${days}:days: Tage`;
  });

  private readonly anonymous = $localize`:@@friends.anonymous:Ohne Namen`;

  protected label(entry: ChallengeEntry): string {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? this.anonymous;
  }

  protected percent(entry: ChallengeEntry): number {
    return challengePercent(entry.value, this.challenge().target);
  }
}
