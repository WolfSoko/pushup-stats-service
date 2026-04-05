import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { StatsApiService } from '@pu-stats/data-access';
import { StatsResponse, toLocalIsoDate } from '@pu-stats/models';
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
  imports: [MatCardModule, MatIconModule, StatsChartComponent],
  template: `
    <mat-card
      class="teaser-card"
      role="link"
      tabindex="0"
      (click)="navigateToAnalysis()"
      (keydown.enter)="navigateToAnalysis()"
      (keyup.space)="navigateToAnalysis(); $event.preventDefault()"
      aria-label="Analyse öffnen"
      i18n-aria-label="@@dashboard.analysisTeaserAriaLabel"
    >
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
            >Diese Woche: {{ weekReps() }}
            @if (weeklyGoal()) {
              / {{ weeklyGoal() }}
            }
            Reps</ng-container
          >
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (statsResource.error()) {
          <p class="error-fallback" i18n="@@dashboard.analysisTeaserError">
            Daten konnten nicht geladen werden.
          </p>
        } @else {
          <div class="mini-chart">
            <app-stats-chart
              [series]="chartSeries()"
              [granularity]="'daily'"
              [rangeMode]="'week'"
              [from]="from()"
              [to]="to()"
            />
          </div>
        }
      </mat-card-content>
      <mat-card-actions align="end">
        <span
          class="teaser-cta"
          aria-label="Zur Analyse navigieren"
          i18n-aria-label="@@dashboard.analysisTeaserCtaAriaLabel"
        >
          <mat-icon>bar_chart</mat-icon>
          <span i18n="@@dashboard.analysisTeaserCta">Zur Analyse</span>
        </span>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .teaser-card {
      cursor: pointer;
      transition:
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .teaser-card:hover,
    .teaser-card:focus {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
      transform: translateY(-2px);
      outline: 2px solid var(--mat-sys-primary, #3f51b5);
      outline-offset: 2px;
    }

    .mini-chart {
      height: clamp(260px, 34vw, 360px);
      overflow: hidden;
      pointer-events: none;
    }

    .error-fallback {
      height: clamp(260px, 34vw, 360px);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--mat-sys-error, #f44336);
    }

    .teaser-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisTeaserCardComponent {
  private readonly api = inject(StatsApiService);
  private readonly router = inject(Router);

  readonly streak = input(0);
  readonly weekReps = input(0);
  readonly weeklyGoal = input(0);

  private readonly weekRange = computed(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toLocalIsoDate(monday), to: toLocalIsoDate(sunday) };
  });

  readonly from = computed(() => this.weekRange().from);
  readonly to = computed(() => this.weekRange().to);

  readonly statsResource = resource({
    params: () => this.weekRange(),
    loader: async ({ params }) => firstValueFrom(this.api.load(params)),
  });

  readonly chartSeries = computed(
    () => (this.statsResource.value() ?? EMPTY_STATS).series
  );

  navigateToAnalysis(): void {
    this.router.navigate(['/analysis']);
  }
}
