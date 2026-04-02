import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StatsApiService } from '@pu-stats/data-access';
import { StatsResponse } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { StatsChartComponent } from '../stats-chart/stats-chart.component';

const EMPTY_STATS: StatsResponse = {
  meta: {
    from: null,
    to: null,
    entries: 0,
    days: 0,
    total: 0,
    granularity: 'daily',
  },
  series: [],
};

@Component({
  selector: 'app-analysis-teaser-card',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    StatsChartComponent,
  ],
  template: `
    <a
      routerLink="/analysis"
      class="teaser-link"
      aria-label="Zur Analyse-Seite"
      i18n-aria-label="@@dashboard.analysisTeaserLinkAria"
    >
      <mat-card class="teaser-card">
        <mat-card-header>
          <mat-card-title i18n="@@dashboard.analysisTeaserTitle"
            >Analyse</mat-card-title
          >
          <mat-card-subtitle>
            <ng-container i18n="@@dashboard.analysisTeaserStreak"
              >Streak: {{ streak() }} Tage</ng-container
            >
            ·
            <ng-container i18n="@@dashboard.analysisTeaserWeekReps"
              >Diese Woche: {{ weekReps() }} Reps</ng-container
            >
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="mini-chart">
            <app-stats-chart
              [series]="chartSeries()"
              [granularity]="'daily'"
              [rangeMode]="'week'"
              [from]="from()"
              [to]="to()"
            />
          </div>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button color="primary" type="button">
            <mat-icon>bar_chart</mat-icon>
            <span i18n="@@dashboard.analysisTeaserCta">Zur Analyse</span>
          </button>
        </mat-card-actions>
      </mat-card>
    </a>
  `,
  styles: `
    .teaser-link {
      display: block;
      text-decoration: none;
      color: inherit;
    }

    .teaser-card {
      cursor: pointer;
      transition:
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .teaser-card:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
      transform: translateY(-2px);
    }

    .mini-chart {
      height: 180px;
      overflow: hidden;
      pointer-events: none;
    }

    mat-card-actions button {
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisTeaserCardComponent {
  private readonly api = inject(StatsApiService);

  readonly streak = input(0);
  readonly weekReps = input(0);

  private readonly weekRange = this.createWeekRange();

  readonly from = computed(() => this.weekRange.from);
  readonly to = computed(() => this.weekRange.to);

  readonly statsResource = resource({
    params: () => ({ from: this.weekRange.from, to: this.weekRange.to }),
    loader: async ({ params }) => firstValueFrom(this.api.load(params)),
  });

  readonly chartSeries = computed(
    () => (this.statsResource.value() ?? EMPTY_STATS).series
  );

  private createWeekRange(): { from: string; to: string } {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      from: this.toLocalIsoDate(monday),
      to: this.toLocalIsoDate(sunday),
    };
  }

  private toLocalIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
