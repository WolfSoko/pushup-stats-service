import {
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  LeaderboardPeriod,
  LeaderboardService,
} from '../../leaderboard.service';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
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
    return Array.from({ length: 10 }, (_, index) => {
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
