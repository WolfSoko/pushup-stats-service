import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { FRIEND_INVITE_PARAM, isValidInviteToken } from '@pu-stats/models';

/** Where a captured invite token waits for the account that redeems it. */
const PENDING_KEY = 'pu:friendInvite:pending';

/**
 * Remembers the invite token from a followed link until there is an
 * account to redeem it with.
 *
 * Deliberately separate from `ReferralService`, which parks `?ref=`: the
 * two expire differently and mean different things. The referral is a
 * public uid that attributes a signup once, inside a 7-day window; this
 * is a credential that opens a friend request and works for an existing
 * account too.
 */
@Injectable({ providedIn: 'root' })
export class FriendInviteService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The token waiting to be redeemed, `null` when there is none. */
  readonly pending = signal<string | null>(null);

  constructor() {
    this.pending.set(this.read());
  }

  /**
   * Picks the token out of a URL's query string and keeps it. The first
   * link a visitor followed is the one that counts, same as the referral.
   */
  capture(search: string): void {
    if (!this.isBrowser) return;
    const value = new URLSearchParams(search).get(FRIEND_INVITE_PARAM);
    if (!isValidInviteToken(value)) return;
    if (this.pending() !== null) return;
    this.write(value);
    this.pending.set(value);
  }

  /** Drop the token — redeemed, refused, or the user's own link. */
  clear(): void {
    this.pending.set(null);
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      // Storage unavailable (private mode / quota) — nothing to clean up.
    }
  }

  private read(): string | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return isValidInviteToken(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      localStorage.setItem(PENDING_KEY, value);
    } catch {
      // Best effort: without storage the token is lost on navigation,
      // which costs the friend request but never blocks the signup.
    }
  }
}
