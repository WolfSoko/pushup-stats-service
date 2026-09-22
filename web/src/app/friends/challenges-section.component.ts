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
import {
  BusyDirective,
  createBusyState,
  SkeletonComponent,
} from '@pu-stats/ui';
import { firstValueFrom } from 'rxjs';

import { ChallengeCardComponent } from './challenge-card.component';
import { ChallengesStore } from './challenges.store';
import { onEntriesChanged } from './on-entries-changed';
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
    BusyDirective,
    ChallengeCardComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    SkeletonComponent,
  ],
  template: `
    <div class="section-head">
      <h2 i18n="@@challenges.title">Challenges</h2>
      <button
        mat-flat-button
        type="button"
        data-testid="challenge-start"
        [disabled]="friends().length === 0"
        [puBusy]="opening.busy() || store.isBusy('create')"
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

    @if (store.loadFailed()) {
      <mat-card class="challenge-error" data-testid="challenges-load-failed">
        <mat-card-content>
          <mat-icon aria-hidden="true">cloud_off</mat-icon>
          <span i18n="@@challenges.loadFailed"
            >Challenges konnten nicht geladen werden.</span
          >
          <button
            mat-button
            type="button"
            data-testid="challenges-retry"
            [puBusy]="store.loading()"
            (click)="store.reload()"
            i18n="@@challenges.retry"
          >
            Erneut laden
          </button>
        </mat-card-content>
      </mat-card>
    }

    @if (store.challenges().length === 0) {
      @if (store.loading()) {
        <mat-card
          class="challenge-skeleton"
          aria-busy="true"
          data-testid="challenges-loading"
        >
          <mat-card-header>
            <mat-card-title
              ><pu-skeleton shape="title" width="45%"
            /></mat-card-title>
            <mat-card-subtitle><pu-skeleton width="30%" /></mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @for (row of skeletonRows; track row) {
              <div class="participant">
                <pu-skeleton width="40%" />
                <pu-skeleton shape="rect" height="4px" />
              </div>
            }
          </mat-card-content>
        </mat-card>
      } @else {
        <p class="muted" i18n="@@challenges.empty">
          Noch keine Challenge. Fordere deine Freunde heraus: ein Ziel, ein paar
          Tage, alle zusammen.
        </p>
      }
    }

    @for (challenge of ordered(); track challenge.id) {
      <app-challenge-card
        [challenge]="challenge"
        [busyKeys]="store.busyKeys()"
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
    .challenge-skeleton mat-card-subtitle {
      margin-top: 6px;
    }
    .challenge-skeleton mat-card-content {
      display: grid;
      gap: 12px;
      padding-top: 12px;
    }
    .participant {
      display: grid;
      gap: 6px;
    }
  `,
})
export class ChallengesSectionComponent {
  protected readonly store = inject(ChallengesStore);
  private readonly dialog = inject(MatDialog);

  /** Confirmed friends — the people a new challenge can invite. */
  readonly friends = input.required<ReadonlyArray<FriendRow>>();

  /** The dialog chunk on its way; the create itself is the store's flag. */
  protected readonly opening = createBusyState();

  protected readonly skeletonRows = [0, 1];

  protected readonly rejection = computed(() =>
    challengeRejectionMessage(this.store.lastRejection())
  );

  constructor() {
    onEntriesChanged(() => void this.store.reload());
  }

  protected readonly ordered = computed(() => [
    ...this.store.invitations(),
    ...this.store.active(),
    ...this.store.ended(),
  ]);

  protected async start(): Promise<void> {
    const { ChallengeCreateDialogComponent } = await this.opening.run(
      () => import('./challenge-create-dialog.component')
    );
    const ref = this.dialog.open(ChallengeCreateDialogComponent, {
      data: { friends: this.friends() },
      autoFocus: 'dialog',
    });
    const input = await firstValueFrom(ref.afterClosed());
    if (input) await this.store.create(input);
  }
}
