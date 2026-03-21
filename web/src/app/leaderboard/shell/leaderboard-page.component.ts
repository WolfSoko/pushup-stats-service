import {
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LeaderboardPeriod, LeaderboardService } from '@pu-stats/data-access';

@Component({
  selector: 'app-leaderboard-page',
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './leaderboard-page.component.html',
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent {
  private readonly leaderboardApi = inject(LeaderboardService, {
    optional: true,
  });

  readonly period = linkedSignal<LeaderboardPeriod>(() => 'daily');

  readonly leaderboardResource = resource({
    loader: async () => {
      if (!this.leaderboardApi) {
        return {
          daily: { top: [], current: null },
          weekly: { top: [], current: null },
          monthly: { top: [], current: null },
        };
      }
      return this.leaderboardApi.load();
    },
  });

  readonly leaderboardEntries = computed(() => {
    const data = this.leaderboardResource.value();
    if (!data) return [];
    return data[this.period()].top;
  });

  readonly currentUserEntry = computed(() => {
    const data = this.leaderboardResource.value();
    if (!data) return null;
    return data[this.period()].current;
  });

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
}
