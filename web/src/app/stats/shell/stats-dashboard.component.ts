import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { catchError, finalize, of } from 'rxjs';
import { StatsGranularity, StatsSeriesEntry } from '@nx-temp/stats-models';
import { StatsApiService } from '@nx-temp/stats-data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { KpiCardsComponent } from '../components/kpi-cards/kpi-cards.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';

@Component({
  selector: 'app-stats-dashboard',
  imports: [MatCardModule, FilterBarComponent, KpiCardsComponent, StatsChartComponent, StatsTableComponent],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
})
export class StatsDashboardComponent implements OnInit {
  private readonly api = inject(StatsApiService);
  private readonly platformId = inject(PLATFORM_ID);

  from = '';
  to = '';
  total = 0;
  days = 0;
  entries = 0;
  avg = '0';
  loading = false;
  granularity: StatsGranularity = 'daily';
  rows: StatsSeriesEntry[] = [];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.api
      .load({ from: this.from || undefined, to: this.to || undefined })
      .pipe(
        catchError(() =>
          of({
            meta: { from: null, to: null, entries: 0, days: 0, total: 0, granularity: 'daily' as const },
            series: [],
            daily: [],
            entries: [],
          }),
        ),
        finalize(() => (this.loading = false)),
      )
      .subscribe((data) => {
        this.granularity = data.meta.granularity;
        this.total = data.meta.total;
        this.days = data.meta.days;
        this.entries = data.meta.entries;
        this.avg = this.days ? (this.total / this.days).toFixed(1) : '0';
        this.rows = data.series;
      });
  }

  reset(): void {
    this.from = '';
    this.to = '';
    this.load();
  }
}
