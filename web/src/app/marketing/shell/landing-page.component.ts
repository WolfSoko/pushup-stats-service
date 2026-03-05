import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

type LeaderboardEntry = {
  alias: string;
  reps: number;
};

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  readonly dailyLeaderboard: LeaderboardEntry[] = [
    { alias: 'Iron•••', reps: 220 },
    { alias: 'Core•••', reps: 180 },
    { alias: 'Power•••', reps: 150 },
    { alias: 'Focus•••', reps: 120 },
    { alias: 'Swift•••', reps: 95 },
  ];
}
