import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { InviteService } from '../core/invite.service';
import { ChallengesSectionComponent } from './challenges-section.component';
import { ChallengesStore } from './challenges.store';
import { FriendRequestsComponent } from './friend-requests.component';
import { FriendsStore } from './friends.store';
import { FriendsBoardComponent } from './friends-board.component';
import { friendRejectionMessage } from './friends-messages';
import type { FriendsBoardPeriod } from './friends-api.service';

/**
 * The friends screen: who you train with, who asked, and who you asked.
 *
 * Requests come first — they are the only part that wants an answer.
 */
@Component({
  selector: 'app-friends-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ChallengesSectionComponent,
    FriendRequestsComponent,
    FriendsBoardComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  template: `
    <main class="page-wrap">
      <app-page-header icon="group" variant="training">
        <h1 page-title i18n="@@friends.title">Freunde</h1>
        <p page-subtitle i18n="@@friends.intro">
          Trainiert gemeinsam: bestätigte Freunde sehen voneinander, was ihre
          Profil-Einstellungen für Freunde freigeben.
        </p>
      </app-page-header>

      @if (rejection(); as message) {
        <mat-card class="friends-error">
          <mat-card-content>
            <mat-icon aria-hidden="true">info</mat-icon>
            <span>{{ message }}</span>
          </mat-card-content>
        </mat-card>
      }

      @if (store.incoming().length > 0) {
        <section>
          <app-friend-requests
            [rows]="store.incoming()"
            (accept)="store.accept($event)"
            (decline)="store.decline($event)"
          />
        </section>
      }

      @if (store.board().length > 1) {
        <section>
          <h2 i18n="@@friends.board">Euer Vergleich</h2>
          <app-friends-board
            [entries]="store.board()"
            [period]="store.boardPeriod()"
            (periodChange)="changePeriod($event)"
            (cheer)="store.cheer($event)"
          />
        </section>
      }

      @if (store.friends().length > 0) {
        <section>
          <app-challenges-section [friends]="store.friends()" />
        </section>
      }

      <section>
        <h2 i18n="@@friends.list">Deine Freunde</h2>
        @if (store.loading() && store.isEmpty()) {
          <mat-spinner diameter="32" />
        } @else if (store.friends().length === 0) {
          <mat-card class="friends-empty">
            <mat-card-content>
              <p i18n="@@friends.empty">
                Noch keine Freunde. Lade jemanden ein — oder öffne ein Profil
                und schicke eine Anfrage.
              </p>
            </mat-card-content>
            <mat-card-actions align="end">
              <button
                mat-flat-button
                color="primary"
                type="button"
                (click)="invite()"
              >
                <mat-icon>person_add</mat-icon>
                <span i18n="@@invite.action">Freunde einladen</span>
              </button>
            </mat-card-actions>
          </mat-card>
        } @else {
          @for (row of store.friends(); track row.id) {
            <mat-card class="friend-card" data-testid="friend-row">
              <mat-card-content>
                <a [routerLink]="['/u', row.uid]">{{
                  name(row.displayName)
                }}</a>
              </mat-card-content>
              <mat-card-actions align="end">
                <button
                  mat-stroked-button
                  type="button"
                  data-testid="friend-remove"
                  (click)="store.remove(row.id)"
                  i18n="@@friends.remove"
                >
                  Entfernen
                </button>
              </mat-card-actions>
            </mat-card>
          }
        }
      </section>

      @if (store.outgoing().length > 0) {
        <section>
          <h2 i18n="@@friends.outgoing">Von dir angefragt</h2>
          @for (row of store.outgoing(); track row.id) {
            <mat-card class="friend-card" data-testid="friend-outgoing">
              <mat-card-content>
                <span>{{ name(row.displayName) }}</span>
                <span class="muted" i18n="@@friends.waiting">wartet noch</span>
              </mat-card-content>
              <mat-card-actions align="end">
                <button
                  mat-stroked-button
                  type="button"
                  (click)="store.remove(row.id)"
                  i18n="@@friends.withdraw"
                >
                  Zurückziehen
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </section>
      }
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 760px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 16px;
    }
    h2 {
      margin: 8px 0;
      font-size: 1.1rem;
    }
    .friend-card {
      margin-bottom: 8px;
    }
    .friend-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .friend-card mat-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .friends-error mat-card-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .muted {
      opacity: 0.7;
      font-size: 0.9rem;
    }
  `,
})
export class FriendsPageComponent implements OnInit {
  protected readonly store = inject(FriendsStore);
  private readonly challenges = inject(ChallengesStore);
  private readonly invites = inject(InviteService);

  protected readonly rejection = computed(() =>
    friendRejectionMessage(this.store.lastRejection())
  );

  ngOnInit(): void {
    void this.store.reload();
    void this.store.loadBoard();
    void this.challenges.reload();
  }

  protected changePeriod(period: unknown): void {
    if (isBoardPeriod(period)) void this.store.loadBoard(period);
  }

  /** A friend who never set a display name still needs a label. */
  protected name(displayName: string | null): string {
    return displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }

  protected invite(): void {
    void this.invites.inviteFriend();
  }
}

function isBoardPeriod(value: unknown): value is FriendsBoardPeriod {
  return (
    value === 'daily' ||
    value === 'week' ||
    value === 'month' ||
    value === 'allTime'
  );
}
