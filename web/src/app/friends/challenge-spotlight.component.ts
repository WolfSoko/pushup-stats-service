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
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { UserContextService } from '@pu-auth/auth';
import { ChallengeCardComponent } from './challenge-card.component';
import { ChallengesStore } from './challenges.store';
import { onEntriesChanged } from './on-entries-changed';

/**
 * The one challenge that matters right now, at the top of the dashboard:
 * an invitation waiting for an answer beats a running one, and of the
 * running ones the one ending soonest is shown. Stays out of the way
 * entirely when there is nothing to show.
 */
@Component({
  selector: 'app-challenge-spotlight',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChallengeCardComponent, MatButtonModule, MatIconModule, RouterLink],
  template: `
    @if (spotlight(); as challenge) {
      <section
        class="spotlight"
        data-testid="dashboard-challenge"
        aria-labelledby="dashboard-challenge-title"
      >
        <h2 id="dashboard-challenge-title">
          <mat-icon aria-hidden="true">flag</mat-icon>
          @if (challenge.viewerInvited) {
            <ng-container i18n="@@dashboard.challenge.invited"
              >Challenge-Einladung</ng-container
            >
          } @else {
            <ng-container i18n="@@dashboard.challenge.running"
              >Freunde-Challenge</ng-container
            >
          }
        </h2>
        <app-challenge-card
          [challenge]="challenge"
          [busyKeys]="store.busyKeys()"
          (accept)="store.accept($event)"
          (decline)="store.decline($event)"
          (leave)="store.leave($event)"
        />
        @if (store.challenges().length > 1) {
          <a
            mat-button
            routerLink="/freunde"
            data-testid="dashboard-challenge-more"
          >
            <span i18n="@@dashboard.challenge.more">Alle Challenges</span>
            <mat-icon iconPositionEnd>chevron_right</mat-icon>
          </a>
        }
      </section>
    }
  `,
  styles: `
    .spotlight {
      display: grid;
      gap: 8px;
      margin-bottom: 16px;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
      font-size: 1.1rem;
    }
    h2 mat-icon {
      color: var(--mat-sys-primary, #3f51b5);
    }
    a[mat-button] {
      justify-self: end;
    }
  `,
})
export class ChallengeSpotlightComponent implements OnInit {
  protected readonly store = inject(ChallengesStore);
  private readonly user = inject(UserContextService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly visible = computed(
    () => !!this.user.userIdSafe() && !this.user.isGuest()
  );

  protected readonly spotlight = computed(() => {
    if (!this.visible()) return null;
    const invitation = this.store.invitations()[0];
    if (invitation) return invitation;
    return (
      [...this.store.active()].sort((a, b) => a.to.localeCompare(b.to))[0] ??
      null
    );
  });

  constructor() {
    onEntriesChanged(() => {
      if (this.visible()) void this.load();
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.visible()) return;
    void this.load();
  }

  /**
   * Counting is cheap, sums are not: ask for progress only once it is
   * known that a running challenge will actually be shown.
   */
  private async load(): Promise<void> {
    await this.store.reload({ progress: false });
    if (this.store.active().length > 0) await this.store.reload();
  }
}
