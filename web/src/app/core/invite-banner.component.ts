import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  resource,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PublicProfileApiService } from '@pu-stats/data-access';

import { ReferralService } from './referral.service';

/**
 * "<Name> hat dich eingeladen" — shown to a visitor who arrived through a
 * shared link, on the pages where they decide whether to join.
 *
 * The inviter's name comes from their public profile, so it only appears
 * for users who opted into one; everyone else stays anonymous and the
 * banner says that someone invited them without naming who. Nothing here
 * reveals more than `/u/:uid` already shows.
 */
@Component({
  selector: 'app-invite-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule],
  template: `
    @if (referral.pending()) {
      <mat-card class="invite-banner">
        <mat-card-content>
          <mat-icon aria-hidden="true">person_add</mat-icon>
          @if (inviterName(); as name) {
            <!-- One message, name included: Angular drops the whitespace-only
                 text node between two elements (preserveWhitespaces is off by
                 default), which glued the name to the verb. A single message
                 also lets a translation move the name. -->
            <span i18n="@@invite.banner.invitedBy"
              ><strong>{{ name }}</strong> hat dich zu Pushup Tracker
              eingeladen.</span
            >
          } @else {
            <span i18n="@@invite.banner.anonymous">
              Du wurdest zu Pushup Tracker eingeladen.
            </span>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .invite-banner {
      border-left: 4px solid var(--mat-sys-primary, #3f51b5);
    }
    mat-card-content {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class InviteBannerComponent {
  protected readonly referral = inject(ReferralService);
  /**
   * Resolved lazily rather than as a field: `PublicProfileApiService`
   * injects `Functions` non-optionally, and this banner sits on the
   * landing page and the public profile — an eager injection would force
   * every test harness of those pages to provide Firebase Functions. No
   * provider simply means no name, which the template already handles.
   */
  private readonly injector = inject(Injector);

  private readonly inviter = resource({
    params: () => ({ uid: this.referral.pending() }),
    loader: ({ params }) => {
      if (!params.uid) return Promise.resolve(null);
      const profiles = this.injector.get(PublicProfileApiService, null);
      if (!profiles) return Promise.resolve(null);
      return profiles.getProfile(params.uid).catch(() => null);
    },
  });

  protected readonly inviterName = computed(
    () => this.inviter.value()?.displayName?.trim() || null
  );
}
