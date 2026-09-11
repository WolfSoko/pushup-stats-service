import { computed, inject, Injectable, LOCALE_ID } from '@angular/core';
import { UserContextService } from '@pu-auth/auth';
import { invitedCount } from '@pu-stats/models';

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
  private readonly localeId = inject(LOCALE_ID) as string;

  /** How many accounts joined through this user's link. */
  readonly invitedCount = computed(() =>
    invitedCount(this.userConfig.config()?.referral)
  );

  /** The link itself, for surfaces that want to show or copy it. */
  readonly inviteUrl = computed(() =>
    buildInviteUrl(
      this.user.userIdSafe(),
      this.localeId,
      this.userConfig.config()?.ui?.publicProfile === true
    )
  );

  async inviteFriend(): Promise<ShareResult> {
    return this.share.share({
      title: $localize`:@@invite.share.title:Pushup Tracker`,
      text: $localize`:@@invite.share.text:Trainier mit mir: Reps per Kamera zählen, Trainingsplan abarbeiten, in der Bestenliste gegeneinander antreten. Kostenlos:`,
      url: this.inviteUrl(),
    });
  }
}
