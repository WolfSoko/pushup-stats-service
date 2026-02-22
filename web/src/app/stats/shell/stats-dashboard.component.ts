import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  PLATFORM_ID,
  REQUEST,
  resource,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  PushupLiveService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import {
  PushupRecord,
  StatsGranularity,
  StatsResponse,
  StatsSeriesEntry,
} from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { UserContextService } from '../../user-context.service';
import { createWeekRange } from '../../util/date/create-week-range';
import { inferRangeMode } from '../../util/date/infer-range-mode';
import { RangeModes } from '../../util/date/range-modes.type';
import { toLocalIsoDate } from '../../util/date/to-local-iso-date';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';

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

const PERIOD_TITLE_MAP: Record<RangeModes | 'today', string> = {
  today: $localize`:@@period.today:Heute`,
  day: $localize`:@@period.day:Tag`,
  week: $localize`:@@period.week:Woche`,
  month: $localize`:@@period.month:Monat`,
  year: $localize`:@@period.year:Jahr`,
  custom: $localize`:@@period.range:Zeitraum`,
};

@Component({
  selector: 'app-stats-dashboard',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DatePipe,
    FilterBarComponent,
    StatsChartComponent,
    StatsTableComponent,
  ],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
})
export class StatsDashboardComponent {
  private readonly api = inject(StatsApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true }) as {
    url?: string;
  } | null;
  private readonly live = inject(PushupLiveService);

  private readonly defaultRange = createWeekRange();
  private readonly initialRange = this.resolveInitialRange();

  readonly from = signal(this.initialRange.from);
  readonly to = signal(this.initialRange.to);
  readonly rangeMode = linkedSignal<RangeModes>(() =>
    inferRangeMode(this.initialRange.from, this.initialRange.to)
  );
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
  readonly allTimeStats = computed(
    () => this.allTimeResource.value() ?? EMPTY_STATS
  );

  readonly total = computed(() => this.stats().meta.total);
  readonly days = computed(() => this.stats().meta.days);
  readonly entries = computed(() => this.stats().meta.entries);
  readonly avg = computed(() =>
    this.days() ? (this.total() / this.days()).toFixed(1) : '0'
  );

  readonly allTimeTotal = computed(() => this.allTimeStats().meta.total);
  readonly allTimeDays = computed(() => this.allTimeStats().meta.days);
  readonly allTimeEntries = computed(() => this.allTimeStats().meta.entries);
  readonly allTimeAvg = computed(() =>
    this.allTimeDays()
      ? (this.allTimeTotal() / this.allTimeDays()).toFixed(1)
      : '0'
  );
  readonly granularity = computed<StatsGranularity>(
    () => this.stats().meta.granularity
  );
  readonly rows = computed<StatsSeriesEntry[]>(() => this.stats().series);
  readonly entryRows = computed<PushupRecord[]>(
    () => this.entriesResource.value() ?? []
  );
  private readonly user = inject(UserContextService);
  private readonly userConfigApi = inject(UserConfigApiService);

  readonly dailyGoal = signal(100);

  readonly userConfigResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) =>
      firstValueFrom(this.userConfigApi.getConfig(params.userId)),
  });

  readonly selectedDayTotal = computed(() => {
    const day = this.from() || toLocalIsoDate(new Date());
    return this.entryRows()
      .filter((entry) => entry.timestamp.slice(0, 10) === day)
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  readonly periodTotal = computed(() => {
    // Use entry data for day view (more robust when user browses non-today days)
    if (this.rangeMode() === 'day') return this.selectedDayTotal();
    return this.total();
  });

  readonly periodGoal = computed(() => {
    const multiplier =
      this.rangeMode() === 'day' ? 1 : Math.max(1, this.days());
    return this.dailyGoal() * multiplier;
  });

  readonly goalProgressPercent = computed(() =>
    this.periodGoal()
      ? Math.min(
          100,
          Math.round((this.periodTotal() / this.periodGoal()) * 100)
        )
      : 0
  );

  readonly periodTitle = computed(() => {
    if (
      this.rangeMode() === 'day' &&
      toLocalIsoDate(new Date()) === this.from()
    ) {
      return PERIOD_TITLE_MAP['today'];
    }
    return PERIOD_TITLE_MAP[this.rangeMode()];
  });

  readonly lastEntry = computed<PushupRecord | null>(() => {
    const rows = this.entryRows();
    if (!rows.length) return null;
    return (
      [...rows].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0] ?? null
    );
  });
  readonly latestEntries = computed<PushupRecord[]>(() => {
    return [...this.entryRows()]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10);
  });
  readonly loading = computed(() => {
    const status = this.statsResource.status();
    return status === 'loading' || status === 'reloading';
  });
  readonly errorMessage = computed(() => {
    if (!this.statsResource.error()) return '';
    return 'Daten konnten nicht geladen werden. Bitte Zeitraum prüfen oder die Seite neu laden.';
  });
  readonly liveConnected = computed(() => this.live.connected());

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

    effect(() => {
      const cfg = this.userConfigResource.value();
      if (!cfg) return;
      this.dailyGoal.set(cfg.dailyGoal ?? 100);
    });

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const tick = this.live.updateTick();
      if (!tick) return;
      this.refreshAll();
    });
  }

  async onCreateEntry(payload: {
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
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

  async onUpdateEntry(payload: {
    id: string;
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }) {
    this.busyAction.set('update');
    this.busyId.set(payload.id);
    try {
      await firstValueFrom(
        this.api.updatePushup(payload.id, {
          timestamp: payload.timestamp,
          reps: payload.reps,
          source: payload.source,
          type: payload.type,
        })
      );
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

  async addQuickEntry(reps: number) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    await this.onCreateEntry({
      timestamp: `${y}-${m}-${d}T${hh}:${mm}`,
      reps,
      source: 'web',
      type: 'Standard',
    });
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
