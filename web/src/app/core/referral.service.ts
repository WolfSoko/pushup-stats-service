import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isValidReferrerId, REFERRAL_PARAM } from '@pu-stats/models';

/** Where a captured invitation waits for the account it belongs to. */
const PENDING_KEY = 'pu:referral:pending';

/**
 * Remembers who invited this visitor until they have an account.
 *
 * The `?ref=` parameter arrives on a shared link and is gone the moment
 * the user navigates — signup can be several routes and a provider
 * redirect later, so the value is parked in `localStorage` and claimed
 * once `ReferralClaimHook` sees an authenticated, non-anonymous user.
 */
@Injectable({ providedIn: 'root' })
export class ReferralService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The invitation waiting to be claimed, `null` when there is none. */
  readonly pending = signal<string | null>(null);

  constructor() {
    this.pending.set(this.read());
  }

  /**
   * Picks the inviter out of a URL's query string and keeps it. Ignores
   * anything that can't be a uid, and never overwrites an invitation that
   * is still waiting — the first link a visitor followed is the one that
   * brought them in.
   */
  capture(search: string): void {
    if (!this.isBrowser) return;
    const value = new URLSearchParams(search).get(REFERRAL_PARAM);
    if (!isValidReferrerId(value)) return;
    if (this.pending() !== null) return;
    this.write(value);
    this.pending.set(value);
  }

  /** Drop the invitation — claimed, refused, or the user's own link. */
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
      return isValidReferrerId(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      localStorage.setItem(PENDING_KEY, value);
    } catch {
      // Best effort: without storage the invitation is lost on navigation,
      // which costs attribution but never blocks the signup.
    }
  }
}
