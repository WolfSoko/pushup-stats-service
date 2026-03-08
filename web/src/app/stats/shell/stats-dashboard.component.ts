import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  PLATFORM_ID,
  REQUEST,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PushupLiveService } from '@pu-stats/data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';
import { DashboardStore } from './dashboard.store';

@Component({
  selector: 'app-stats-dashboard',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    DatePipe,
    FilterBarComponent,
    StatsChartComponent,
    StatsTableComponent,
  ],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDashboardComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true }) as {
    url?: string;
  } | null;
  private readonly live = inject(PushupLiveService);

  readonly store = inject(DashboardStore);

  readonly from = this.store.from;
  readonly to = this.store.to;
  readonly rangeMode = this.store.rangeMode;
  readonly busyAction = this.store.busyAction;
  readonly busyId = this.store.busyId;

  readonly total = this.store.total;
  readonly days = this.store.days;
  readonly entries = this.store.entries;
  readonly avg = this.store.avg;

  readonly allTimeTotal = this.store.allTimeTotal;
  readonly allTimeDays = this.store.allTimeDays;
  readonly allTimeEntries = this.store.allTimeEntries;
  readonly allTimeAvg = this.store.allTimeAvg;

  readonly granularity = this.store.granularity;
  readonly rows = this.store.rows;
  readonly entryRows = this.store.entryRows;

  readonly dailyGoal = this.store.dailyGoal;
  readonly dayChartMode = this.store.dayChartMode;
  readonly savingDayChartMode = this.store.savingDayChartMode;

  readonly selectedDayTotal = this.store.selectedDayTotal;
  readonly periodTotal = this.store.periodTotal;
  readonly periodGoal = this.store.periodGoal;
  readonly goalProgressPercent = this.store.goalProgressPercent;
  readonly periodTitle = this.store.periodTitle;
  readonly lastEntry = this.store.lastEntry;
  readonly latestEntries = this.store.latestEntries;
  readonly loading = this.store.loading;
  readonly errorMessage = this.store.errorMessage;
  readonly liveConnected = this.store.liveConnected;

  constructor() {
    void this.store.initFromUrl(this.resolveSearchString());

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const params = new URLSearchParams();
      const from = this.from();
      const to = this.to();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const query = params.toString();
      const nextUrl = `${this.document.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    });

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const tick = this.live.updateTick();
      if (!tick) return;
      void this.store.refreshAll();
    });
  }

  onFromChange(from: string) {
    this.store.setFrom(from);
  }

  onToChange(to: string) {
    this.store.setTo(to);
  }

  onModeChange(mode: 'day' | 'week' | 'month' | 'year' | 'custom') {
    this.store.setRangeMode(mode);
  }

  onCreateEntry(payload: {
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    return this.store.onCreateEntry(payload);
  }

  onUpdateEntry(payload: {
    id: string;
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    return this.store.onUpdateEntry(payload);
  }

  onDeleteEntry(id: string) {
    return this.store.onDeleteEntry(id);
  }

  onDayChartModeChange(mode: '24h' | '14h') {
    return this.store.onDayChartModeChange(mode);
  }

  addQuickEntry(reps: number) {
    return this.store.addQuickEntry(reps);
  }

  private resolveSearchString(): string {
    if (isPlatformBrowser(this.platformId)) {
      return this.document.location.search || '';
    }

    const url = this.request?.url || '';
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return '';
    return url.slice(qIndex);
  }
}
