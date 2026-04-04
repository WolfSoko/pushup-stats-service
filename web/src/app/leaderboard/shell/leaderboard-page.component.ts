import {
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LeaderboardPeriod, LeaderboardStore } from '@pu-stats/data-access';

@Component({
  selector: 'app-leaderboard-page',
  imports: [MatCardModule, MatButtonModule],
  templateUrl: './leaderboard-page.component.html',
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent {
  private readonly store = inject(LeaderboardStore);

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
