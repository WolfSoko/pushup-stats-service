import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import {
  appendLocalOffset,
  QUICK_LOG_REPS_MAX,
  QUICK_LOG_REPS_MIN,
} from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from '../../core/quick-add-orchestration.service';
import { AppDataFacade } from '../../core/app-data.facade';
import { AdSlotComponent } from '@pu-stats/ads';
import { AnalysisTeaserCardComponent } from '../components/analysis-teaser-card/analysis-teaser-card.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { StatsTableComponent } from '../components/stats-table/stats-table.component';
import {
  CreateEntryDialogComponent,
  CreateEntryResult,
} from '../components/create-entry-dialog/create-entry-dialog.component';
import { QuickAddConfigDialogComponent } from '../components/quick-add-config-dialog/quick-add-config-dialog.component';
import { DashboardStore } from '../dashboard.store';

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
    RouterLink,
  ],
  providers: [DashboardStore],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDashboardComponent {
  private readonly api = inject(StatsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly live = inject(LiveDataStore);
  private readonly quickAdd = inject(QuickAddOrchestrationService);
  private readonly appData = inject(AppDataFacade);

  readonly store = inject(DashboardStore);

  // Delegate store signals for template access
  readonly allTimeTotal = this.store.allTimeTotal;
  readonly allTimeDays = this.store.allTimeDays;
  readonly allTimeEntries = this.store.allTimeEntries;
  readonly allTimeAvg = this.store.allTimeAvg;
  readonly todayTotal = this.store.todayTotal;
  readonly dailyGoal = this.store.dailyGoal;
  readonly goalProgressPercent = this.store.goalProgressPercent;
  readonly weeklyGoal = this.store.weeklyGoal;
  readonly weeklyGoalProgressPercent = this.store.weeklyGoalProgressPercent;
  readonly monthReps = this.store.monthReps;
  readonly monthlyGoal = this.store.monthlyGoal;
  readonly monthlyGoalProgressPercent = this.store.monthlyGoalProgressPercent;
  readonly todayQuote = this.store.todayQuote;
  readonly lastEntry = this.store.lastEntry;
  readonly latestEntries = this.store.latestEntries;
  readonly currentStreak = this.store.currentStreak;
  readonly weekReps = this.store.weekReps;
  readonly loading = this.store.loading;
  readonly liveConnected = this.store.liveConnected;
  readonly dailyGoalConfigured = this.store.dailyGoalConfigured;
  readonly remainingToGoal = this.store.remainingToGoal;
  readonly goalReached = this.store.goalReached;
  readonly weeklyGoalReached = this.store.weeklyGoalReached;
  readonly monthlyGoalReached = this.store.monthlyGoalReached;
  readonly fillToGoalInFlight = this.quickAdd.fillToGoalInFlight;
  readonly quickAddButtons = this.store.quickAddButtons;
  readonly adSlotDashboardInline = this.store.adSlotDashboardInline;
  readonly dashboardInlineAdsEnabled = this.store.dashboardInlineAdsEnabled;
  readonly planActive = this.store.planActive;
  readonly planTodayTarget = this.store.planTodayTarget;
  readonly planTodayKind = this.store.planTodayKind;
  readonly planTitle = this.store.planTitle;
  readonly planDayIndex = this.store.planDayIndex;
  readonly planTotalDays = this.store.planTotalDays;
  /** Counter that increments on every data refresh to trigger child component reloads. */
  readonly refreshCounter = signal(0);

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

    const quickAddBridge = inject(QuickAddBridgeService);
    effect(() => {
      const tick = quickAddBridge.openDialogTick();
      if (!tick) return; // skip initial value (0)
      untracked(() => {
        if (viewReady) {
          this.openCreateDialog();
        } else {
          pendingOpenCreateDialog = true;
        }
      });
    });

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const tick = this.live.updateTick();
      if (!tick) return;
      this.store.refreshAll();
      this.refreshCounter.update((c) => c + 1);
    });

    this.store.loadQuote();
  }

  fillToGoal(): void {
    this.quickAdd.fillToGoal();
  }

  openCreateDialog(): void {
    this.dialog
      .open<CreateEntryDialogComponent, void, CreateEntryResult>(
        CreateEntryDialogComponent,
        { width: 'min(92vw, 420px)', maxWidth: '92vw' }
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.createEntry(result);
      });
  }

  openQuickAddConfig(): void {
    this.dialog.open(QuickAddConfigDialogComponent, {
      width: 'min(92vw, 480px)',
      maxWidth: '92vw',
    });
  }

  navigateToHistory(): void {
    void this.router.navigate(['/history']);
  }

  /**
   * Called after render — handles two notification deep-links:
   *   - `?log=1`     → open create-entry dialog (existing behavior)
   *   - `?quickLog=N` → silently log N pushups (notification button click
   *                     when no app tab was open — see sw-push handlers).
   *
   * `quickLog` arrives via URL and is therefore untrusted: clamp into the
   * configured `[QUICK_LOG_REPS_MIN, QUICK_LOG_REPS_MAX]` range so a tampered
   * link can't persist absurd entries (CodeRabbit/Copilot/Codex P1, PR #249).
   */
  private readonly _handleLogParam = afterNextRender(() => {
    const params = this.route.snapshot.queryParamMap;
    const quickLog = params.get('quickLog');
    const quickReps = quickLog != null ? Number(quickLog) : NaN;
    if (Number.isFinite(quickReps) && quickReps >= QUICK_LOG_REPS_MIN) {
      const clamped = Math.min(Math.floor(quickReps), QUICK_LOG_REPS_MAX);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { quickLog: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      // Attribute deep-link entries to the reminder so source-based analytics
      // match the in-tab `QUICK_LOG_PUSHUPS` path (CodeRabbit/Copilot P2).
      void this.addQuickEntry(clamped, 'reminder');
      return;
    }
    const log = params.get('log');
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

  async createEntry(entry: {
    timestamp: string;
    reps: number;
    sets?: number[];
    source?: string;
    type?: string;
  }) {
    await firstValueFrom(this.api.createPushup(entry));
    this.store.refreshAll();
    this.appData.reloadAfterMutation();
    this.refreshCounter.update((c) => c + 1);
  }

  async addQuickEntry(reps: number, source: 'web' | 'reminder' = 'web') {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    await firstValueFrom(
      this.api.createPushup({
        timestamp: appendLocalOffset(`${y}-${m}-${d}T${hh}:${mm}`),
        reps,
        sets: [reps],
        source,
        type: 'Standard',
      })
    );
    this.store.refreshAll();
    this.appData.reloadAfterMutation();
    this.refreshCounter.update((c) => c + 1);
  }
}
