import { Component, computed, inject, linkedSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { LeaderboardPeriod, LeaderboardStore } from '@pu-stats/data-access';
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

  readonly currentUserId = this.user.userIdSafe;
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
