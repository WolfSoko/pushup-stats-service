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
import { firstValueFrom } from 'rxjs';

import { ChallengeCardComponent } from './challenge-card.component';
import { ChallengesStore } from './challenges.store';
import type { FriendRow } from './friends-api.service';
import { challengeRejectionMessage } from './friends-messages';

/**
 * The challenges block on the friends screen: invitations first (they
 * want an answer), then what is running, then last week's results — and
 * the button that starts a new one. The dialog is dynamic-imported so
 * the friends page stays light for people who never open it.
 */
@Component({
  selector: 'app-challenges-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChallengeCardComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
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

    @for (challenge of ordered(); track challenge.id) {
      <app-challenge-card
        [challenge]="challenge"
        (accept)="store.accept($event)"
        (decline)="store.decline($event)"
        (leave)="store.leave($event)"
      />
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

  protected readonly ordered = computed(() => [
    ...this.store.invitations(),
    ...this.store.active(),
    ...this.store.ended(),
  ]);

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
