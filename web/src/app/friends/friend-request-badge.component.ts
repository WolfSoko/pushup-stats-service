import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import { ChallengesStore } from './challenges.store';
import { FriendsStore } from './friends.store';

/**
 * What waits for the user under "Freunde", next to the nav entry: a
 * count of friend requests, and a small envelope while a challenge
 * invitation wants an answer. Self-loading, so the app shell needs to
 * know nothing about friends — it just places the badge where the
 * label is.
 */
@Component({
  selector: 'app-friend-request-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (challenges.invitations().length > 0) {
      <mat-icon
        class="invite"
        data-testid="challenge-invite-badge"
        [attr.aria-label]="inviteLabel(challenges.invitations().length)"
        role="img"
        >mail</mat-icon
      >
    }
    @if (store.pendingCount() > 0) {
      <span
        class="badge"
        data-testid="friend-request-badge"
        [attr.aria-label]="ariaLabel(store.pendingCount())"
        >{{ store.pendingCount() }}</span
      >
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }
    .invite {
      width: 16px;
      height: 16px;
      font-size: 16px;
      margin-left: 6px;
      color: var(--mat-sys-primary, #81a1e8);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      margin-left: 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1;
      color: var(--mat-sys-on-error, #fff);
      background: var(--mat-sys-error, #d32f2f);
    }
  `,
})
export class FriendRequestBadgeComponent implements OnInit {
  protected readonly store = inject(FriendsStore);
  protected readonly challenges = inject(ChallengesStore);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    // Only the browser has a signed-in user; the server render has no
    // requests to count and no callable to ask.
    if (!isPlatformBrowser(this.platformId)) return;
    void this.store.reload();
    void this.challenges.reload({ progress: false });
  }

  protected inviteLabel(count: number): string {
    return count === 1
      ? $localize`:@@friends.badge.invitationOne:Eine Challenge-Einladung wartet`
      : $localize`:@@friends.badge.invitations:${count}:count: Challenge-Einladungen warten`;
  }

  protected ariaLabel(count: number): string {
    return count === 1
      ? $localize`:@@nav.friends.pendingAriaOne:Eine offene Freundschaftsanfrage`
      : $localize`:@@nav.friends.pendingAria:${count}:count: offene Freundschaftsanfragen`;
  }
}
