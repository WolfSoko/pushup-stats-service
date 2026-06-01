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
import {
  ExerciseFirestoreService,
  StatsApiService,
} from '@pu-stats/data-access';
import { LiveDataStore } from '@pu-stats/data-access-state';
import { UserContextService } from '@pu-auth/auth';
import {
  displayPushupType,
  findExerciseDefinition,
  formatEntryDisplay,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  QUICK_LOG_REPS_MAX,
  QUICK_LOG_REPS_MIN,
  UnifiedEntry,
} from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { exerciseDisplayName } from '../i18n/exercise-display-names';
import { firstValueFrom } from 'rxjs';
import { QuickAddBridgeService } from '@pu-stats/quick-add';
import {
  autoCountProfileForCatalogId,
  QuickAddOrchestrationService,
} from '../../core/quick-add-orchestration.service';
import { AppDataFacade } from '../../core/app-data.facade';
import { AdSlotComponent } from '@pu-stats/ads';
import { AnalysisTeaserCardComponent } from '../components/analysis-teaser-card/analysis-teaser-card.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import {
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../components/training-entry-dialog/training-entry-dialog.component';
import { QuickAddConfigDialogComponent } from '../components/quick-add-config-dialog/quick-add-config-dialog.component';
import {
  DashboardStore,
  type QuickAddButtonViewModel,
} from '../dashboard.store';

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
  private readonly exerciseService = inject(ExerciseFirestoreService);
  private readonly userContext = inject(UserContextService);
  private readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly live = inject(LiveDataStore);
  private readonly quickAdd = inject(QuickAddOrchestrationService);
  private readonly appData = inject(AppDataFacade);
  private readonly locale = inject(LOCALE_ID) as string;

  readonly pushupTypeLabel = (
    entry: Extract<UnifiedEntry, { kind: 'pushup' }>
  ): string => displayPushupType(entry.variantType, this.locale);

  // Mirrors stats-table.formatEntry so the dashboard preview matches
  // the history page when a catalog definition exists (plank → m:ss,
  // cardio.running → distance · time (pace), etc.).
  readonly exerciseEntryValue = (
    entry: Extract<UnifiedEntry, { kind: 'exercise' }>
  ): string => {
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return String(entry.reps);
    return formatEntryDisplay(entry, def);
  };

  readonly exerciseEntryLabel = (
    entry: Extract<UnifiedEntry, { kind: 'exercise' }>
  ): string => exerciseDisplayName(entry.exerciseId);

  readonly tileIcon = (entry: UnifiedEntry): string =>
    entry.kind === 'pushup' ? 'fitness_center' : 'sports_gymnastics';

  readonly tileAriaLabel = (entry: UnifiedEntry): string => {
    const label =
      entry.kind === 'pushup'
        ? $localize`:@@dashboard.tile.pushupTitle:Liegestütze`
        : this.exerciseEntryLabel(entry);
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
  // Exposed for the template so the quick-add branch can compare against
  // the canonical sentinel instead of the literal string 'pushup' —
  // keeps one source of truth between the schema, the orchestrator, and
  // the dashboard.
  protected readonly PUSHUP_QUICK_ADD_EXERCISE_ID =
    PUSHUP_QUICK_ADD_EXERCISE_ID;
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
      width: 'min(92vw, 480px)',
      maxWidth: '92vw',
    });
  }

  navigateToHistory(): void {
    void this.router.navigate(['/history']);
  }

  shareDay(): void {
    void this.store.shareDay();
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
   *
   * Snooze always wins: if `?snooze=N` is also present, the user explicitly
   * snoozed and did NOT want to log push-ups in this navigation. Skip both
   * deep-links so a combined or stale URL can never silently create an entry
   * alongside the snooze — App.ts consumes the snooze param separately.
   */
  private readonly _handleLogParam = afterNextRender(() => {
    const params = this.route.snapshot.queryParamMap;
    if (params.has('snooze')) return;
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

  async createEntry(result: TrainingEntryDialogResult) {
    if (result.kind === 'pushup') {
      await firstValueFrom(
        this.api.createPushup({
          timestamp: result.timestamp,
          reps: result.reps,
          sets: result.sets,
          source: result.source,
          type: result.type,
        })
      );
    } else {
      const userId = this.userContext.userIdSafe();
      if (!userId) return;
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
    await firstValueFrom(
      this.api.createPushup({
        timestamp: nowLocalIsoTimestamp(),
        reps,
        sets: [reps],
        source,
        type: 'standard',
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
