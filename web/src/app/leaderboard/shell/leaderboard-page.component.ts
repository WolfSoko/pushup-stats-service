import { Component, computed, inject, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { LeaderboardPeriod } from '@pu-stats/data-access';
import { LeaderboardStore } from '@pu-stats/data-access-state';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';

@Component({
  selector: 'app-leaderboard-page',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    PageHeaderComponent,
  ],
  templateUrl: './leaderboard-page.component.html',
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent {
  private readonly store = inject(LeaderboardStore);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);

  readonly currentUserId = this.user.userIdSafe;
  /**
   * Suppress the hint while auth is still bootstrapping. Otherwise an
   * authenticated user briefly sees the "sign in" CTA on cold load before
   * `currentUserId` populates.
   */
  readonly authResolved = this.auth.authResolved;
  readonly isLoggedIn = computed(
    () => this.currentUserId() !== '' && !this.user.isGuest()
  );

  readonly period = linkedSignal<LeaderboardPeriod>(() => 'daily');

  readonly leaderboardEntries = this.store.entriesForPeriod(this.period);
  readonly currentUserEntry = this.store.currentUserForPeriod(this.period);

  readonly leaderboardSlots = computed(() => {
    const top = this.leaderboardEntries();
    return Array.from({ length: 25 }, (_, index) => {
      const entry = top[index];
      return (
        entry ?? {
          alias: '—',
          reps: 0,
          rank: index + 1,
        }
      );
    });
  });

  constructor() {
    this.store.load();
  }
}
