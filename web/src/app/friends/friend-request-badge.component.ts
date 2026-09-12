import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';

import { FriendsStore } from './friends.store';

/**
 * The count of friend requests waiting for an answer, next to the nav
 * entry. Self-loading, so the app shell needs to know nothing about
 * friends — it just places the badge where the label is.
 */
@Component({
  selector: 'app-friend-request-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
      vertical-align: middle;
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
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    // Only the browser has a signed-in user; the server render has no
    // requests to count and no callable to ask.
    if (isPlatformBrowser(this.platformId)) void this.store.reload();
  }

  protected ariaLabel(count: number): string {
    return count === 1
      ? $localize`:@@nav.friends.pendingAriaOne:Eine offene Freundschaftsanfrage`
      : $localize`:@@nav.friends.pendingAria:${count}:count: offene Freundschaftsanfragen`;
  }
}
