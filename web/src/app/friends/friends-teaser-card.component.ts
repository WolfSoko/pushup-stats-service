import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';

import { InviteService } from '../core/invite.service';
import { ChallengesStore } from './challenges.store';
import { FriendsStore } from './friends.store';

const TOP_ROWS = 3;

/**
 * The friends feature on the dashboard: this week's standing among
 * friends, requests waiting for an answer, challenges running — or, for
 * someone without friends yet, the reason to invite one.
 *
 * Renders nothing for guests: a friends list needs an account.
 */
@Component({
  selector: 'app-friends-teaser-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  template: `
    @if (visible()) {
      <mat-card class="friends-card" data-testid="dashboard-friends-card">
        <mat-card-header>
          <mat-icon mat-card-avatar aria-hidden="true">group</mat-icon>
          <mat-card-title i18n="@@dashboard.friends.title"
            >Freunde</mat-card-title
          >
          @if (friends.pendingCount() > 0) {
            <mat-card-subtitle
              class="pending"
              data-testid="dashboard-friends-pending"
              >{{ pendingLabel(friends.pendingCount()) }}</mat-card-subtitle
            >
          } @else if (challenges.invitations().length > 0) {
            <mat-card-subtitle
              class="pending"
              data-testid="dashboard-friends-invitations"
              >{{
                invitationsLabel(challenges.invitations().length)
              }}</mat-card-subtitle
            >
          } @else if (challenges.active().length > 0) {
            <mat-card-subtitle data-testid="dashboard-friends-challenges">{{
              challengesLabel(challenges.active().length)
            }}</mat-card-subtitle>
          }
        </mat-card-header>
        <mat-card-content>
          @if (hasBoard()) {
            <p class="standing" data-testid="dashboard-friends-standing">
              {{ standingLabel() }}
            </p>
            <ol class="mini-board">
              @for (entry of topRows(); track entry.uid; let i = $index) {
                <li
                  [class.is-viewer]="entry.isViewer"
                  data-testid="dashboard-friends-row"
                >
                  <span class="rank">{{ i + 1 }}</span>
                  <span class="name">{{ label(entry) }}</span>
                  <strong>{{ entry.value }}</strong>
                </li>
              }
            </ol>
          } @else if (friends.friendCount() === 0) {
            <p i18n="@@dashboard.friends.empty">
              Trainier mit Freunden: vergleicht euch, feuert euch an und startet
              gemeinsame Challenges.
            </p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          @if (friends.friendCount() === 0) {
            <button
              mat-flat-button
              type="button"
              data-testid="dashboard-friends-invite"
              (click)="invite()"
            >
              <mat-icon>person_add</mat-icon>
              <span i18n="@@invite.action">Freunde einladen</span>
            </button>
          }
          <a
            mat-button
            routerLink="/freunde"
            data-testid="dashboard-friends-link"
          >
            <span i18n="@@dashboard.friends.open">Zu den Freunden</span>
            <mat-icon iconPositionEnd>chevron_right</mat-icon>
          </a>
        </mat-card-actions>
      </mat-card>
    }
  `,
  styles: `
    .friends-card mat-card-header {
      align-items: center;
    }
    .friends-card mat-icon[mat-card-avatar] {
      font-size: 32px;
      width: 32px;
      height: 32px;
      background: none;
      color: var(--mat-sys-primary, #3f51b5);
    }
    .pending {
      color: var(--mat-sys-error, #d32f2f);
      font-weight: 600;
    }
    .standing {
      margin: 0 0 8px;
      font-weight: 500;
    }
    .mini-board {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }
    .mini-board li {
      display: grid;
      grid-template-columns: 1.5rem 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    :host-context(.dark-theme) .mini-board li {
      background: rgba(255, 255, 255, 0.05);
    }
    .mini-board li.is-viewer {
      outline: 2px solid var(--mat-sys-primary, #3f51b5);
    }
    .rank {
      opacity: 0.6;
      font-variant-numeric: tabular-nums;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    mat-card-actions {
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class FriendsTeaserCardComponent implements OnInit {
  protected readonly friends = inject(FriendsStore);
  protected readonly challenges = inject(ChallengesStore);
  private readonly user = inject(UserContextService);
  private readonly invites = inject(InviteService);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly visible = computed(
    () => !!this.user.userIdSafe() && !this.user.isGuest()
  );

  /** A board of one is not a comparison. */
  protected readonly hasBoard = computed(() => this.friends.board().length > 1);

  protected readonly topRows = computed(() =>
    this.friends.board().slice(0, TOP_ROWS)
  );

  protected readonly standingLabel = computed(() => {
    const board = this.friends.board();
    const rank = board.findIndex((entry) => entry.isViewer) + 1;
    const total = board.length;
    if (rank === 1) {
      return $localize`:@@dashboard.friends.leading:Du führst diese Woche unter ${total}:total: Freunden.`;
    }
    return $localize`:@@dashboard.friends.rank:Du bist diese Woche auf Platz ${rank}:rank: von ${total}:total:.`;
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.visible()) return;
    void this.friends.reload();
    // A preview: the friends page keeps whatever period the user picked.
    void this.friends.loadBoard('week', { remember: false });
    // Only counted here — no need for every participant's sums.
    void this.challenges.reload({ progress: false });
  }

  protected label(entry: { isViewer: boolean; displayName: string | null }) {
    if (entry.isViewer) return $localize`:@@friends.board.you:Du`;
    return entry.displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }

  protected pendingLabel(count: number): string {
    return count === 1
      ? $localize`:@@dashboard.friends.pendingOne:Eine Anfrage wartet auf dich`
      : $localize`:@@dashboard.friends.pending:${count}:count: Anfragen warten auf dich`;
  }

  protected invitationsLabel(count: number): string {
    return count === 1
      ? $localize`:@@dashboard.friends.invitationOne:Eine Challenge-Einladung wartet`
      : $localize`:@@dashboard.friends.invitations:${count}:count: Challenge-Einladungen warten`;
  }

  protected challengesLabel(count: number): string {
    return count === 1
      ? $localize`:@@dashboard.friends.activeChallengeOne:Eine Challenge läuft`
      : $localize`:@@dashboard.friends.activeChallenges:${count}:count: Challenges laufen`;
  }

  protected invite(): void {
    void this.invites.inviteFriend();
  }
}
