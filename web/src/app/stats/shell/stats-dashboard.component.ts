import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  PushupLiveService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { PushupRecord, StatsResponse } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { AdSlotComponent, AdsConfigService } from '@pu-stats/ads';
import { UserContextService } from '@pu-auth/auth';
import { toLocalIsoDate } from '@pu-stats/models';
import { AnalysisTeaserCardComponent } from '../components/analysis-teaser-card/analysis-teaser-card.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';
import { MotivationalQuoteService } from '../services/motivational-quote.service';

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
  selector: 'app-stats-dashboard',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    DatePipe,
    AnalysisTeaserCardComponent,
    PreviewBannerComponent,
    StatsTableComponent,
    AdSlotComponent,
  ],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDashboardComponent {
  private readonly api = inject(StatsApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly live = inject(PushupLiveService);
  private readonly adsConfig = inject(AdsConfigService);
  private readonly quoteService = inject(MotivationalQuoteService);

  readonly statsTable = viewChild(StatsTableComponent);

  readonly entriesResource = resource({
    loader: async () => firstValueFrom(this.api.listPushups({})),
  });

  readonly allTimeResource = resource({
    loader: async () => firstValueFrom(this.api.load({})),
  });

  readonly allTimeStats = computed(
    () => this.allTimeResource.value() ?? EMPTY_STATS
  );

  readonly allTimeTotal = computed(() => this.allTimeStats().meta.total);
  readonly allTimeDays = computed(() => this.allTimeStats().meta.days);
  readonly allTimeEntries = computed(() => this.allTimeStats().meta.entries);
  readonly allTimeAvg = computed(() =>
    this.allTimeDays()
      ? (this.allTimeTotal() / this.allTimeDays()).toFixed(1)
      : '0'
  );

  readonly entryRows = computed<PushupRecord[]>(
    () => this.entriesResource.value() ?? []
  );

  readonly currentStreak = computed(() => {
    const dates = this.sortedUniqueDates();
    if (!dates.length) return 0;

    const today = toLocalIsoDate(new Date());
    const lastDate = dates[dates.length - 1];

    // If last entry is not today or yesterday (or is in the future), streak is 0
    const daysDiff = this.daysBetween(lastDate, today);
    if (daysDiff > 1 || daysDiff < 0) return 0;

    let streak = 1;
    for (let i = dates.length - 1; i > 0; i--) {
      if (this.daysBetween(dates[i - 1], dates[i]) === 1) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  });

  readonly weekReps = computed(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const mondayStr = toLocalIsoDate(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = toLocalIsoDate(sunday);

    return this.entryRows()
      .filter((entry) => {
        const day = entry.timestamp.slice(0, 10);
        return day >= mondayStr && day <= sundayStr;
      })
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  private readonly user = inject(UserContextService);
  private readonly userConfigApi = inject(UserConfigApiService);

  readonly dailyGoal = signal(100);
  readonly todayQuote = computed(() => this.quoteService.getTodayQuote());

  readonly adClient = this.adsConfig.adClient;
  readonly adSlotDashboardInline = this.adsConfig.dashboardInlineSlot;
  readonly dashboardInlineAdsEnabled = this.adsConfig.dashboardInlineEnabled;

  readonly userConfigResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) =>
      firstValueFrom(this.userConfigApi.getConfig(params.userId)),
  });

  readonly todayTotal = computed(() => {
    const today = toLocalIsoDate(new Date());
    return this.entryRows()
      .filter((entry) => entry.timestamp.slice(0, 10) === today)
      .reduce((sum, entry) => sum + entry.reps, 0);
  });

  readonly goalProgressPercent = computed(() =>
    this.dailyGoal()
      ? Math.min(100, Math.round((this.todayTotal() / this.dailyGoal()) * 100))
      : 0
  );

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
      .slice(0, 5);
  });

  readonly loading = computed(() => {
    const status = this.entriesResource.status();
    return status === 'loading' || status === 'reloading';
  });

  readonly liveConnected = computed(() => this.live.connected());

  constructor() {
    let viewReady = false;
    let pendingOpenCreateDialog = false;

    afterNextRender(() => {
      viewReady = true;
      if (pendingOpenCreateDialog) {
        pendingOpenCreateDialog = false;
        this.openCreateDialog();
      }
    });

    inject(QuickAddBridgeService)
      .openDialog$.pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (viewReady) {
          this.openCreateDialog();
        } else {
          pendingOpenCreateDialog = true;
        }
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

  openCreateDialog(): void {
    this.statsTable()?.openCreateDialog();
  }

  /** Called after render — opens create dialog if ?log=1 is in the URL */
  private readonly _handleLogParam = afterNextRender(() => {
    const log = this.route.snapshot.queryParamMap.get('log');
    if (log === '1') {
      // Clean up URL without re-navigating
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { log: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      this.openCreateDialog();
    }
  });

  async addQuickEntry(reps: number) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    await firstValueFrom(
      this.api.createPushup({
        timestamp: `${y}-${m}-${d}T${hh}:${mm}`,
        reps,
        source: 'web',
        type: 'Standard',
      })
    );
    this.refreshAll();
  }

  private refreshAll() {
    this.allTimeResource.reload();
    this.entriesResource.reload();
  }

  private sortedUniqueDates(): string[] {
    return [
      ...new Set(this.entryRows().map((x) => x.timestamp.slice(0, 10))),
    ].sort((a, b) => a.localeCompare(b));
  }

  private daysBetween(a: string, b: string): number {
    const ad = new Date(`${a}T00:00:00`);
    const bd = new Date(`${b}T00:00:00`);
    ad.setHours(0, 0, 0, 0);
    bd.setHours(0, 0, 0, 0);
    return Math.round((bd.getTime() - ad.getTime()) / 86_400_000);
  }
}
