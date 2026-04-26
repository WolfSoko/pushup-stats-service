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
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { appendLocalOffset } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from '../../core/quick-add-orchestration.service';
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

// Monotonic counter used to mint unique DOM ids for the goal-reached dialog
// title element (see openGoalReachedDialog).
let nextDialogTitleId = 0;

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

  private readonly goalReachedDialogShown: Record<
    'daily' | 'weekly' | 'monthly',
    boolean
  > = { daily: false, weekly: false, monthly: false };

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

    this.registerGoalReachedTrigger(
      'daily',
      this.goalReached,
      this.todayTotal,
      this.store.dailyGoal
    );
    this.registerGoalReachedTrigger(
      'weekly',
      this.weeklyGoalReached,
      this.weekReps,
      this.weeklyGoal
    );
    this.registerGoalReachedTrigger(
      'monthly',
      this.monthlyGoalReached,
      this.monthReps,
      this.monthlyGoal
    );

    this.store.loadQuote();
  }

  private registerGoalReachedTrigger(
    kind: 'daily' | 'weekly' | 'monthly',
    reached: () => boolean,
    total: () => number,
    goal: () => number
  ): void {
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const isReached = reached();
      if (!isReached) {
        this.goalReachedDialogShown[kind] = false;
        return;
      }
      if (this.goalReachedDialogShown[kind]) return;
      this.goalReachedDialogShown[kind] = true;
      untracked(() => {
        void this.openGoalReachedDialog(kind, {
          total: total(),
          goal: goal(),
        });
      });
    });
  }

  private async openGoalReachedDialog(
    kind: 'daily' | 'weekly' | 'monthly',
    snapshot: { total: number; goal: number }
  ): Promise<void> {
    const { GoalReachedDialogComponent } =
      await import('../components/goal-reached-dialog/goal-reached-dialog.component');
    // Unique title id per dialog instance — daily/weekly/monthly can all
    // be open at once if a single entry crosses several thresholds, and
    // duplicate DOM ids would make ariaLabelledBy resolution ambiguous.
    const titleId = `goal-reached-dialog-title-${nextDialogTitleId++}`;
    this.dialog.open(GoalReachedDialogComponent, {
      panelClass: 'goal-reached-dialog-panel',
      backdropClass: 'goal-reached-dialog-backdrop',
      autoFocus: 'dialog',
      restoreFocus: true,
      ariaLabelledBy: titleId,
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
      data: { kind, total: snapshot.total, goal: snapshot.goal, titleId },
    });
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

  async createEntry(entry: {
    timestamp: string;
    reps: number;
    sets?: number[];
    source?: string;
    type?: string;
  }) {
    await firstValueFrom(this.api.createPushup(entry));
    this.store.refreshAll();
    this.refreshCounter.update((c) => c + 1);
  }

  async addQuickEntry(reps: number) {
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
        source: 'web',
        type: 'Standard',
      })
    );
    this.store.refreshAll();
    this.refreshCounter.update((c) => c + 1);
  }
}
