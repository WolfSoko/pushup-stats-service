import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { computed } from '@angular/core';
import { TrainingPlanStore } from '../../training-plans/training-plan.store';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { UserContextService } from '@pu-auth/auth';
import {
  findExerciseDefinition,
  formatEntryDisplay,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  UnifiedEntry,
} from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { exerciseDisplayName } from '../i18n/exercise-display-names';
import { firstValueFrom } from 'rxjs';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import { QuickAddOrchestrationService } from '../../core/quick-add-orchestration.service';
import { autoCountProfileForCatalogId } from '../../core/quick-add-orchestration.helpers';
import { AppDataFacade } from '../../core/app-data.facade';
import { DailyGoalActionsService } from '../../core/daily-goal-actions.service';
import type { DailyGoalItemView } from '../../core/daily-goal.helpers';
import { DailyGoalChecklistComponent } from '../../core/daily-goal/daily-goal-checklist.component';
import { registerDashboardDeepLinks } from './stats-dashboard.deep-links';
import { AdSlotComponent } from '@pu-stats/ads';
import { AnalysisTeaserCardComponent } from '../components/analysis-teaser-card/analysis-teaser-card.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { TrainingEntryDialogComponent } from '../components/training-entry-dialog/training-entry-dialog.component';
import {
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../components/training-entry-dialog/training-entry-dialog.models';
import { QuickAddConfigDialogComponent } from '../components/quick-add-config-dialog/quick-add-config-dialog.component';
import { DashboardStore } from '../dashboard.store';
import type { QuickAddButtonViewModel } from '../dashboard/quick-add-view-model';
import {
  ExerciseToggle,
  PlanDayExercisesComponent,
} from '../../training-plans/plan-day-exercises.component';
import {
  logPlanToday,
  logPlanTodayExercise,
  planTodayView,
  resetPlanTodayExercise,
  togglePlanTodayExercise,
} from './stats-dashboard.plan-checklist';

@Component({
  selector: 'app-stats-dashboard',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    DatePipe,
    AnalysisTeaserCardComponent,
    DailyGoalChecklistComponent,
    PlanDayExercisesComponent,
    PreviewBannerComponent,
    AdSlotComponent,
    RouterLink,
  ],
  providers: [DashboardStore],
  templateUrl: './stats-dashboard.component.html',
  styleUrl: './stats-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDashboardComponent {
  private readonly exerciseService = inject(ExerciseFirestoreService);
  private readonly userContext = inject(UserContextService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(MatSnackBar);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly live = inject(LiveDataStore);
  private readonly quickAdd = inject(QuickAddOrchestrationService);
  private readonly appData = inject(AppDataFacade);
  private readonly locale = inject(LOCALE_ID) as string;

  // Mirrors stats-table.formatEntry so the dashboard preview matches
  // the history page when a catalog definition exists (plank → m:ss,
  // cardio.running → distance · time (pace), etc.).
  readonly exerciseEntryValue = (entry: UnifiedEntry): string => {
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return String(entry.reps);
    return formatEntryDisplay(entry, def);
  };

  readonly exerciseEntryLabel = (entry: UnifiedEntry): string =>
    exerciseDisplayName(entry.exerciseId);

  readonly tileAriaLabel = (entry: UnifiedEntry): string => {
    const label = this.exerciseEntryLabel(entry);
    return $localize`:@@dashboard.tile.openInHistoryAria:${label}:label: in der Historie öffnen`;
  };

  readonly shareDayAriaLabel = $localize`:@@dashboard.share.aria:Tagesleistung teilen`;
  readonly shareDayLabel = $localize`:@@dashboard.share:Teilen`;

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
  readonly planDayIndex = this.store.planDayIndex;
  readonly planTotalDays = this.store.planTotalDays;
  readonly isPlanRestDay = this.store.isPlanRestDay;
  readonly userConfiguredDailyGoal = this.store.userConfiguredDailyGoal;
  /** Per-exercise daily goal breakdown shared with the toolbar pill. */
  readonly dailyGoalBreakdown = this.appData.dailyGoalBreakdown;
  private readonly goalActions = inject(DailyGoalActionsService);
  /** Goal ids whose check-off write is still in flight. */
  readonly dailyGoalPending = this.goalActions.pending;
  private readonly trainingPlans = inject(TrainingPlanStore);
  /**
   * Only render the "no active plan" banner once the plan resource has
   * actually resolved. Otherwise users with an active plan see a
   * misleading "Pick a plan" CTA flicker on every cold load while the
   * Firestore listener is still hydrating.
   */
  readonly showNoPlanBanner = computed(
    () => this.trainingPlans.activePlanLoaded() && !this.planActive()
  );
  /** Plan title in the active locale. Falls back to '' when no plan. */
  readonly planTitle = computed(
    () => this.trainingPlans.activeCatalog()?.title ?? ''
  );
  /** Active plan slug — used to deep-link the banner CTA. */
  readonly planSlug = computed(
    () => this.trainingPlans.activeCatalog()?.slug ?? ''
  );
  /** Counter that increments on every data refresh to trigger child component reloads. */
  readonly refreshCounter = signal(0);

  /**
   * Today's plan-day checklist — one row per prescribed exercise, unlike
   * `planTodayTarget` (the single pushup-equivalent figure mirrored into
   * `dailyGoal`). Backs the "Zielfortschritt" card and the plan-aware
   * "fill to goal" action when a plan is active.
   */
  private readonly planToday = planTodayView(this.trainingPlans);
  readonly planTodayExerciseRows = this.planToday.exerciseRows;
  readonly planTodayFulfilled = this.planToday.fulfilled;
  /** In-flight guard for the plan-aware "fill to goal" action — the store
   *  has no public signal for `logTodayPlanDay`, so tracked locally like
   *  `QuickAddOrchestrationService.fillToGoalInFlight`. */
  private readonly _planFillInFlight = signal(false);
  readonly planFillInFlight = this._planFillInFlight.asReadonly();

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

    registerDashboardDeepLinks({
      route: this.route,
      router: this.router,
      openCreateDialog: () => this.openCreateDialog(),
      // Attribute deep-link entries to the reminder so source-based analytics
      // match the in-tab `QUICK_LOG_PUSHUPS` path (CodeRabbit/Copilot P2).
      quickLog: (reps) => void this.addQuickEntry(reps, 'reminder'),
    });

    this.store.loadQuote();
  }

  /**
   * With an active plan, "fill to goal" means logging every exercise the
   * day still prescribes — not just pushups. The legacy pushup-only path
   * stays for users without an active plan.
   */
  async fillToGoal(): Promise<void> {
    if (this.planActive() && !this.isPlanRestDay()) {
      if (this._planFillInFlight()) return;
      this._planFillInFlight.set(true);
      try {
        await logPlanToday(this.trainingPlans, this.snackbar);
      } finally {
        this._planFillInFlight.set(false);
      }
      return;
    }
    this.quickAdd.fillToGoal();
  }

  /** One-click log for a single exercise of today's plan day. */
  logPlanExercise(itemIndex: number): Promise<void> {
    return logPlanTodayExercise(
      this.trainingPlans,
      this.snackbar,
      this.planToday.dayIndex(),
      itemIndex
    );
  }

  /** Manual check-off (or un-check) of a single plan exercise. */
  togglePlanExercise(event: ExerciseToggle): Promise<void> {
    return togglePlanTodayExercise(
      this.trainingPlans,
      this.planToday.dayIndex(),
      event
    );
  }

  /** Re-opens a single plan exercise, dropping the entries it wrote. */
  resetPlanExercise(itemIndex: number): Promise<void> {
    return resetPlanTodayExercise(
      this.trainingPlans,
      this.snackbar,
      this.planToday.dayIndex(),
      itemIndex
    );
  }

  /** Ticking a sub-goal logs the amount still missing for it. */
  async completeDailyGoal(item: DailyGoalItemView): Promise<void> {
    const result = await this.goalActions.complete(item);
    if (result !== 'logged') return;
    this.store.refreshAll();
    this.refreshCounter.update((c) => c + 1);
  }

  openCreateDialog(): void {
    this.dialog
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData | null,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, {
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) void this.createEntry(result);
      });
  }

  openQuickAddConfig(): void {
    this.dialog.open(QuickAddConfigDialogComponent, {
      width: 'min(92vw, 460px)',
      maxWidth: '92vw',
    });
  }

  navigateToHistory(): void {
    void this.router.navigate(['/history']);
  }

  shareDay(): void {
    void this.store.shareDay();
  }

  async createEntry(result: TrainingEntryDialogResult) {
    const userId = this.userContext.userIdSafe();
    if (!userId) return;
    if (result.kind === 'pushup') {
      await firstValueFrom(
        this.exerciseService.createEntry(userId, {
          exerciseId: 'pushup',
          timestamp: result.timestamp,
          reps: result.reps,
          sets: result.sets,
          source: result.source,
        })
      );
    } else {
      const intervals = result.intervals ?? [];
      await firstValueFrom(
        this.exerciseService.createEntry(userId, {
          exerciseId: result.exerciseId,
          timestamp: result.timestamp,
          ...(result.measurement === 'time'
            ? {
                durationSec: result.durationSec ?? 0,
                ...(intervals.length > 0 ? { intervals } : {}),
              }
            : result.measurement === 'distance-time'
              ? {
                  distanceM: result.distanceM ?? 0,
                  durationSec: result.durationSec ?? 0,
                  ...(intervals.length > 0 ? { intervals } : {}),
                }
              : result.measurement === 'distance'
                ? {
                    distanceM: result.distanceM ?? 0,
                    ...(intervals.length > 0 ? { intervals } : {}),
                  }
                : {
                    reps: result.reps,
                    ...(result.sets.length > 1 ? { sets: result.sets } : {}),
                  }),
          ...(result.variantId ? { variantId: result.variantId } : {}),
        })
      );
    }
    this.store.refreshAll();
    this.appData.reloadAfterMutation();
    this.refreshCounter.update((c) => c + 1);
  }

  async addQuickEntry(
    reps: number,
    source: 'web' | 'reminder' | 'quick-add' = 'web'
  ) {
    const userId = this.userContext.userIdSafe();
    if (!userId) return;
    await firstValueFrom(
      this.exerciseService.createEntry(userId, {
        exerciseId: 'pushup',
        timestamp: nowLocalIsoTimestamp(),
        reps,
        sets: [reps],
        source,
      })
    );
    this.store.refreshAll();
    this.appData.reloadAfterMutation();
    this.refreshCounter.update((c) => c + 1);
  }

  /**
   * Click handler for the configurable Schnellaktionen buttons. Routes by
   * mode + exerciseId:
   *  - `auto-count`     → camera dialog (preselected exercise); the
   *                       orchestrator handles confirmation + persistence.
   *  - `reps` + pushup  → legacy pushups collection via StatsApi.
   *  - `reps` + other   → exerciseEntries collection via ExerciseFirestoreService.
   *
   * Source attribution is `'quick-add'` for rep buttons and `'auto-count'`
   * for camera buttons (the latter set inside the orchestrator) so the
   * analytics breakdown can distinguish dashboard quick-adds from the
   * manual entry dialog.
   */
  async addQuickEntryFromConfig(vm: QuickAddButtonViewModel): Promise<void> {
    if (vm.mode === 'auto-count') {
      const profile = autoCountProfileForCatalogId(vm.exerciseId);
      if (!profile) return;
      void this.quickAdd.openAutoCount(profile);
      return;
    }
    if (vm.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
      await this.addQuickEntry(vm.reps, 'quick-add');
      return;
    }
    const userId = this.userContext.userIdSafe();
    if (!userId) return;
    await firstValueFrom(
      this.exerciseService.createEntry(userId, {
        exerciseId: vm.exerciseId,
        timestamp: nowLocalIsoTimestamp(),
        reps: vm.reps,
        source: 'quick-add',
      })
    );
    this.store.refreshAll();
    this.appData.reloadAfterMutation();
    this.refreshCounter.update((c) => c + 1);
  }
}
