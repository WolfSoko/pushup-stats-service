import { computed, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import { BRAND_NAME, invitedCount } from '@pu-stats/models';

import { FriendInviteApiService } from './friend-invite-api.service';
import { buildInviteUrl } from './profile-share-url';
import { ShareService, type ShareResult } from './share.service';
import { UserConfigStore } from './user-config.store';

/**
 * "Invite a friend": the outward half of the sharing loop.
 *
 * Separate from the dashboard's "share today" action on purpose — that one
 * reports a result, this one asks someone to join, and the copy has to say
 * so. Both end up in the same share sheet.
 */
@Injectable({ providedIn: 'root' })
export class InviteService {
  private readonly share = inject(ShareService);
  private readonly user = inject(UserContextService);
  private readonly userConfig = inject(UserConfigStore);
  private readonly api = inject(FriendInviteApiService);
  private readonly localeId = inject(LOCALE_ID) as string;

  /**
   * The caller's invite token once fetched. Null until then — and for a
   * guest, whose token the server refuses — in which case the link still
   * attributes a signup but opens no friend request.
   */
  private readonly token = signal<string | null>(null);
  /** The fetch in flight, so parallel callers share one round trip. */
  private inFlight: Promise<string | null> | null = null;

  /** How many accounts joined through this user's link. */
  readonly invitedCount = computed(() =>
    invitedCount(this.userConfig.config()?.referral)
  );

  /** The link itself, for surfaces that want to show or copy it. */
  readonly inviteUrl = computed(() =>
    buildInviteUrl(
      this.user.userIdSafe(),
      this.localeId,
      this.userConfig.config()?.ui?.publicProfile === true,
      this.token()
    )
  );

  /** Whether the link carries a token, i.e. whether it can add a friend. */
  readonly canAddFriend = computed(() => this.token() !== null);

  /**
   * Makes sure the token is there before the link goes anywhere. Failure
   * is not fatal: the link degrades to the referral-only form it had
   * before tokens existed.
   */
  async ensureToken(): Promise<string | null> {
    if (this.token() !== null) return this.token();
    this.inFlight ??= this.api
      .create()
      .catch(() => null)
      .finally(() => {
        this.inFlight = null;
      });
    const token = await this.inFlight;
    if (token) this.token.set(token);
    return token;
  }

  async inviteFriend(): Promise<ShareResult> {
    await this.ensureToken();
    return this.share.share({
      title: $localize`:@@invite.share.title:${BRAND_NAME}:brand:`,
      text: $localize`:@@invite.share.text:Trainier mit mir: Reps per Kamera zählen, uns gegenseitig anfeuern und gemeinsame Challenges starten. Kostenlos:`,
      url: this.inviteUrl(),
    });
  }
}
