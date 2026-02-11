import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, REQUEST, computed, effect, inject, resource, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';
import { PushupRecord, StatsGranularity, StatsResponse, StatsSeriesEntry } from '@nx-temp/stats-models';
import { StatsApiService } from '@nx-temp/stats-data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { KpiCardsComponent } from '../components/kpi-cards/kpi-cards.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';

const EMPTY_STATS: StatsResponse = {
  meta: { from: null, to: null, entries: 0, days: 0, total: 0, granularity: 'daily' },
  series: [],
};

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createDefaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = toLocalIsoDate(now);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 6);
  const from = toLocalIsoDate(fromDate);
  return { from, to };
}

@Component({
  selector: 'app-stats-dashboard',
  imports: [MatCardModule, FilterBarComponent, KpiCardsComponent, StatsChartComponent, StatsTableComponent],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
})
export class StatsDashboardComponent {
  private readonly api = inject(StatsApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true }) as { url?: string } | null;

  private readonly defaultRange = createDefaultRange();
  private readonly initialRange = this.resolveInitialRange();

  readonly from = signal(this.initialRange.from);
  readonly to = signal(this.initialRange.to);
  readonly busyAction = signal<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = signal<string | null>(null);

  private readonly filter = computed(() => ({
    from: this.from() || undefined,
    to: this.to() || undefined,
  }));

  readonly statsResource = resource({
    params: () => this.filter(),
    loader: async ({ params }) => firstValueFrom(this.api.load(params)),
  });

  readonly entriesResource = resource({
    params: () => this.filter(),
    loader: async ({ params }) => firstValueFrom(this.api.listPushups(params)),
  });

  readonly allTimeResource = resource({
    loader: async () => firstValueFrom(this.api.load({})),
  });

  readonly stats = computed(() => this.statsResource.value() ?? EMPTY_STATS);
  readonly allTimeStats = computed(() => this.allTimeResource.value() ?? EMPTY_STATS);

  readonly total = computed(() => this.stats().meta.total);
  readonly days = computed(() => this.stats().meta.days);
  readonly entries = computed(() => this.stats().meta.entries);
  readonly avg = computed(() => (this.days() ? (this.total() / this.days()).toFixed(1) : '0'));

  readonly allTimeTotal = computed(() => this.allTimeStats().meta.total);
  readonly allTimeDays = computed(() => this.allTimeStats().meta.days);
  readonly allTimeEntries = computed(() => this.allTimeStats().meta.entries);
  readonly allTimeAvg = computed(() =>
    this.allTimeDays() ? (this.allTimeTotal() / this.allTimeDays()).toFixed(1) : '0',
  );
  readonly granularity = computed<StatsGranularity>(() => this.stats().meta.granularity);
  readonly rows = computed<StatsSeriesEntry[]>(() => this.stats().series);
  readonly entryRows = computed<PushupRecord[]>(() => this.entriesResource.value() ?? []);
  readonly loading = computed(() => {
    const status = this.statsResource.status();
    return status === 'loading' || status === 'reloading';
  });
  readonly errorMessage = computed(() => {
    if (!this.statsResource.error()) return '';
    return 'Daten konnten nicht geladen werden. Bitte Zeitraum prüfen oder die Seite neu laden.';
  });

  constructor() {
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
  }

  async onCreateEntry(payload: { timestamp: string; reps: number; source?: string }) {
    this.busyAction.set('create');
    this.busyId.set(null);
    try {
      await firstValueFrom(this.api.createPushup(payload));
      this.refreshAll();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  async onUpdateEntry(payload: { id: string; reps: number; source?: string }) {
    this.busyAction.set('update');
    this.busyId.set(payload.id);
    try {
      await firstValueFrom(this.api.updatePushup(payload.id, { reps: payload.reps, source: payload.source }));
      this.refreshAll();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  async onDeleteEntry(id: string) {
    this.busyAction.set('delete');
    this.busyId.set(id);
    try {
      await firstValueFrom(this.api.deletePushup(id));
      this.refreshAll();
    } finally {
      this.busyAction.set(null);
      this.busyId.set(null);
    }
  }

  private refreshAll() {
    this.statsResource.reload();
    this.allTimeResource.reload();
    this.entriesResource.reload();
  }

  private resolveInitialRange(): { from: string; to: string } {
    const search = this.resolveSearchString();
    const params = new URLSearchParams(search);
    const from = params.get('from') ?? this.defaultRange.from;
    const to = params.get('to') ?? this.defaultRange.to;
    return { from, to };
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
