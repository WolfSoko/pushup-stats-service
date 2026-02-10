import { Component, OnInit, PLATFORM_ID, computed, inject, resource, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';
import { StatsGranularity, StatsResponse, StatsSeriesEntry } from '@nx-temp/stats-models';
import { StatsApiService } from '@nx-temp/stats-data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { KpiCardsComponent } from '../components/kpi-cards/kpi-cards.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';

const EMPTY_STATS: StatsResponse = {
  meta: { from: null, to: null, entries: 0, days: 0, total: 0, granularity: 'daily' },
  series: [],
};

@Component({
  selector: 'app-stats-dashboard',
  imports: [MatCardModule, FilterBarComponent, KpiCardsComponent, StatsChartComponent, StatsTableComponent],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
})
export class StatsDashboardComponent implements OnInit {
  private readonly api = inject(StatsApiService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly from = signal('');
  readonly to = signal('');

  private readonly filter = computed(() => ({
    from: this.from() || undefined,
    to: this.to() || undefined,
  }));

  readonly statsResource = resource({
    params: () => this.filter(),
    loader: async ({ params }) => firstValueFrom(this.api.load(params)),
  });

  readonly stats = computed(() => this.statsResource.value() ?? EMPTY_STATS);
  readonly total = computed(() => this.stats().meta.total);
  readonly days = computed(() => this.stats().meta.days);
  readonly entries = computed(() => this.stats().meta.entries);
  readonly avg = computed(() => (this.days() ? (this.total() / this.days()).toFixed(1) : '0'));
  readonly granularity = computed<StatsGranularity>(() => this.stats().meta.granularity);
  readonly rows = computed<StatsSeriesEntry[]>(() => this.stats().series);
  readonly loading = computed(() => {
    const status = this.statsResource.status();
    return status === 'loading' || status === 'reloading';
  });
  readonly errorMessage = computed(() => {
    if (!this.statsResource.error()) return '';
    return 'Daten konnten nicht geladen werden. Bitte Zeitraum prüfen oder die Seite neu laden.';
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const now = new Date();
      const to = now.toISOString().slice(0, 10);
      const fromDate = new Date(now);
      fromDate.setDate(fromDate.getDate() - 6);
      const from = fromDate.toISOString().slice(0, 10);
      this.from.set(from);
      this.to.set(to);
    }
  }

}
