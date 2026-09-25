import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OverlayModule } from '@angular/cdk/overlay';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Auth } from '@angular/fire/auth';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MatToolbarModule } from '@angular/material/toolbar';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { BRAND_NAME } from '@pu-stats/models';
import { AuthService, AuthStore, UserMenuComponent } from '@pu-auth/auth';

import { AvatarService } from './core/avatar.service';
import { CheerFireworksOverlayComponent } from './core/cheer-fireworks-overlay.component';
import { PendingRequestIndicatorComponent } from './core/pending-request-indicator.component';
import { NotificationBellComponent } from './notifications/notification-bell.component';
import { NotificationStore } from './notifications/notification.store';
import { filter } from 'rxjs';
import { AiAssistantNavButtonComponent } from './ai/ai-assistant-nav-button.component';
import { FriendInviteService } from './core/friend-invite.service';
import { ReferralService } from './core/referral.service';
import { SeoService } from './core/seo.service';
import { FeatureFlagsService, UserContextService } from '@pu-auth/auth';
import {
  PushSubscriptionService,
  PushSwRegistrationService,
} from '@pu-push/push';
import { TcfConsentService } from '@pu-stats/ads';
import {
  QuickAddFabComponent,
  QuickAddFabCoachmarkComponent,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { UserConfigStore } from './core/user-config.store';
import { DailyGoalActionsService } from './core/daily-goal-actions.service';
import { DailyGoalChecklistComponent } from './core/daily-goal/daily-goal-checklist.component';
import { toGoalDialItems } from './core/daily-goal/goal-dial-items';
import { createGoalPillOverlay } from './core/daily-goal/goal-pill-overlay';
import { ThemeToggleComponent } from './core/theme';
import { ReminderOrchestrationService } from './core/reminder-orchestration.service';
import { AndroidTestInviteOrchestrationService } from './core/android-test-invite-orchestration.service';
import { FeatureAnnouncementService } from './core/feature-announcement.service';
import { AppUpdateBannerComponent } from './core/app-update/app-update-banner.component';
import { AppUpdateService } from './core/app-update/app-update.service';
import { ChunkLoadRecoveryService } from './core/app-update/chunk-load-recovery.service';
import { AppDataFacade } from './core/app-data.facade';
import { QuickAddOrchestrationService } from './core/quick-add-orchestration.service';
import { AchievementCelebrationService } from './achievements/achievement-celebration.service';
import { XpCelebrationService } from './core/xp/xp-celebration.service';
import { GoalReachedNotificationService } from './core/goal-reached-notification.service';
import { FeedbackDialogComponent } from './core/feedback/feedback-dialog.component';
import { FeedbackService } from './core/feedback/feedback.service';
import { AppSidenavComponent } from './core/nav/app-sidenav.component';
import { ArcNavComponent } from './core/nav/arc-nav.component';
import { mainNavItems } from './core/nav/main-nav-items';
import { ownProfilePath } from './core/profile-share-url';
import {
  FeedbackDialogData,
  FeedbackResult,
} from './core/feedback/feedback.models';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatSnackBarModule,
    MatSidenavModule,
    MatIconModule,
    UserMenuComponent,
    QuickAddFabComponent,
    QuickAddFabCoachmarkComponent,
    ThemeToggleComponent,
    AiAssistantNavButtonComponent,
    DailyGoalChecklistComponent,
    ArcNavComponent,
    AppSidenavComponent,
    MatDialogModule,
    OverlayModule,
    CheerFireworksOverlayComponent,
    NotificationBellComponent,
    PendingRequestIndicatorComponent,
    AppUpdateBannerComponent,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {
  protected readonly avatar = inject(AvatarService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly firebaseAuth = inject(Auth, { optional: true });
  private readonly feedbackService = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly user = inject(UserContextService);
  private readonly featureFlags = inject(FeatureFlagsService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly userConfig = inject(UserConfigStore);
  readonly isAdmin = computed(() => this.user.isAdmin());
  readonly autoCountEnabled = computed(() =>
    this.featureFlags.autoExerciseCounter()
  );
  readonly isLoggedIn = computed(
    () => !!this.user.userIdSafe() && !this.user.isGuest()
  );
  readonly navItems = computed(() => mainNavItems(this.isLoggedIn()));
  private readonly notifications = inject(NotificationStore);
  readonly unreadNotifications = computed(() =>
    this.isLoggedIn() ? this.notifications.unreadCount() : 0
  );
  /** The signed-in user's own profile page, for the sidenav. */
  readonly profileUrl = computed(() => ownProfilePath(this.user.userIdSafe()));
  // The speed-dial FAB is for anyone who can persist an entry — guests have a
  // real (anonymous) auth uid and can quick-add too, so it shows for them as
  // well, unlike the reminders nav which is gated to signed-in accounts.
  readonly showQuickAddFab = computed(() => !!this.user.userIdSafe());
  private readonly pushService = inject(PushSubscriptionService);
  private readonly pushSwRegistration = inject(PushSwRegistrationService);
  // Eagerly register the push service worker on boot so:
  //   - fresh visitors have the SW installed before they ever open /reminders
  //     (no cold-start race on the first `subscribe()` click), and
  //   - existing subscribers pull the latest `sw-push.js` via the browser's
  //     update check even when they never navigate to /reminders.
  // Lives next to `registerSwListener()` which wires the `message` bridge
  // for PUSH_SUBSCRIPTION_CHANGED events fired by the push SW.
  private readonly _initPushBridge = afterNextRender(() => {
    this.pushService.registerSwListener();
    void this.pushSwRegistration.getRegistration();
  });
  private static readonly COACHMARK_SEEN_KEY = 'pus_speeddial_coachmark_seen';

  /** Drives the one-time tutorial bubble pointing at the speed-dial FAB. */
  protected readonly speedDialCoachmarkVisible = signal(false);
  // Latch so the trigger effect resolves exactly once per session — the
  // onboarding signal is backed by a Firestore listener that may re-emit.
  private speedDialCoachmarkResolved = false;

  // Show the coachmark the first time a logged-in user lands after completing
  // onboarding (`consent.acceptedAt` is set). The localStorage flag keeps it a
  // one-time hint; before onboarding the config has no `acceptedAt` so the
  // bubble naturally stays hidden until the flow finishes.
  private readonly _maybeShowSpeedDialCoachmark = effect(() => {
    if (this.speedDialCoachmarkResolved) return;
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.isLoggedIn()) return;
    const config = this.userConfig.config();
    if (!config) return; // resource not hydrated yet
    if (!config.consent?.acceptedAt) return; // onboarding not finished
    this.speedDialCoachmarkResolved = true;
    let seen: boolean;
    try {
      seen = localStorage.getItem(App.COACHMARK_SEEN_KEY) === '1';
    } catch {
      seen = true; // no storage → don't nag
    }
    if (!seen) this.speedDialCoachmarkVisible.set(true);
  });

  dismissSpeedDialCoachmark(): void {
    this.speedDialCoachmarkVisible.set(false);
    try {
      localStorage.setItem(App.COACHMARK_SEEN_KEY, '1');
    } catch {
      // localStorage unavailable — bubble simply reappears next session
    }
  }

  private readonly seo = inject(SeoService);
  private readonly referral = inject(ReferralService);
  private readonly friendInvite = inject(FriendInviteService);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly auth = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly reminderOrchestration = inject(ReminderOrchestrationService);
  private readonly quickAdd = inject(QuickAddOrchestrationService);
  private readonly appData = inject(AppDataFacade);
  // Eager-inject so the goal-reached celebration fires regardless of which
  // page is mounted when the user crosses a daily/weekly/monthly threshold.
  private readonly _goalReachedNotifier = inject(
    GoalReachedNotificationService
  );
  // Eager-inject so a badge earned while the user is on any page still
  // gets its celebration — awarding happens server-side, so the document
  // can sync at any moment.
  private readonly _achievements = inject(AchievementCelebrationService);
  // Eager-inject so every saved entry gets its XP celebration, whichever
  // screen saved it.
  private readonly _xpCelebration = inject(XpCelebrationService);
  // Eager-inject so the Android closed-test invite popup can fire regardless
  // of which page is mounted.
  private readonly _androidTestInvite = inject(
    AndroidTestInviteOrchestrationService
  );
  // Eager-inject so the "what's new" walkthrough fires once the dashboard
  // is up, whichever page the user signed in from.
  private readonly _announcements = inject(FeatureAnnouncementService);
  // Eager-inject so update detection and the navigation fallback run from
  // the first page on, not only once the banner has something to show.
  private readonly _appUpdate = inject(AppUpdateService);
  private readonly _chunkLoadRecovery = inject(ChunkLoadRecoveryService);

  // Delegate to facade
  readonly quickAddSuggestions = this.appData.quickAddSuggestions;
  readonly dailyGoal = this.appData.dailyGoal;
  readonly todayProgress = this.appData.todayProgress;
  readonly remainingToGoal = this.appData.remainingToGoal;
  readonly goalReached = this.appData.goalReached;
  readonly hasDailyGoal = this.appData.hasDailyGoal;
  /**
   * Aggregated daily-goal completion (0–100). Drives the toolbar pill
   * label whenever goals are scored per exercise — falls back to the
   * legacy `progress / target` reps display when a single pushup target
   * is all that applies today.
   */
  readonly dailyGoalAggregatedPercent = this.appData.dailyGoalAggregatedPercent;
  readonly hasComplexDailyGoals = computed(
    () =>
      this.appData.perExerciseGoals() &&
      this.appData.todayGoalEntries().length > 0
  );
  /**
   * Whether the toolbar pill has anything to show at all today — false on
   * a plan rest day with no user-configured goal and no complex goals, so
   * the pill doesn't invent a target (e.g. "10 / 100") that was never set.
   */
  readonly hasAnyDailyGoal = computed(
    () => this.hasComplexDailyGoals() || this.hasDailyGoal()
  );
  /**
   * Per-exercise breakdown for the toolbar pill's hover/touch dropdown.
   * Lists every daily goal (or every exercise the active plan day
   * prescribes) with its target, progress and completion share.
   */
  readonly dailyGoalBreakdown = this.appData.dailyGoalBreakdown;
  protected readonly goalDetailsAriaLabel = $localize`:@@toolbarDailyGoal.detailsAria:Tagesziel-Einzelpositionen anzeigen`;

  private readonly goalOverlay = createGoalPillOverlay(
    () => this.dailyGoalBreakdown().length > 0
  );
  protected readonly goalDetailsOpen = this.goalOverlay.open;
  protected readonly goalOverlayPositions = this.goalOverlay.positions;

  openGoalDetails(): void {
    this.goalOverlay.show();
  }

  scheduleCloseGoalDetails(): void {
    this.goalOverlay.scheduleHide();
  }

  closeGoalDetails(): void {
    this.goalOverlay.hide();
  }
  readonly quickAddBusyKeys = this.quickAdd.busyKeys;

  private readonly goalActions = inject(DailyGoalActionsService);
  /** Daily goals rendered as the speed dial's goal submenu. */
  readonly goalDialItems = computed(() =>
    toGoalDialItems(this.dailyGoalBreakdown(), (id) =>
      this.goalActions.isPending(id)
    )
  );

  handleFillGoalItem(goalId: string): void {
    const item = this.dailyGoalBreakdown().find((i) => i.id === goalId);
    if (!item) return;
    void this.goalActions.complete(item);
  }

  private readonly tcfConsent = inject(TcfConsentService);

  openCookieSettings(): void {
    this.tcfConsent.openConsentSettings();
  }

  /** Whether the sidenav is open (same behavior on all screen sizes). */
  readonly navOpen = signal(false);

  constructor() {
    // Invitations arrive as `?ref=` (who to credit) and `?fi=` (the token
    // that opens the friend request) on a shared link, and are gone after
    // the first navigation — so both are captured before anything else runs.
    if (isPlatformBrowser(this.platformId)) {
      const search = globalThis.location?.search ?? '';
      this.referral.capture(search);
      this.friendInvite.capture(search);
    }

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const nav = event as NavigationEnd;
        const leaf = this.currentLeafRoute();
        const data = leaf.snapshot.data as {
          seoTitle?: string;
          seoDescription?: string;
          noindex?: boolean;
        };

        const title =
          data.seoTitle ?? $localize`:@@seo.default.title:${BRAND_NAME}:brand:`;
        const description =
          data.seoDescription ??
          $localize`:@@seo.default.description:Wiederholungen per Kamera zählen, Trainingsplänen folgen, Streaks halten — kostenlos im Browser.`;

        const path = nav.urlAfterRedirects || nav.url;
        this.seo.update(title, description, path, { noindex: data.noindex });
        this.trackAnalytics('page_view', { page_path: path });
      });
  }

  handleQuickAdd(suggestion: QuickAddSuggestion): void {
    void this.quickAdd.addSuggestion(suggestion);
  }

  handleOpenDialog(): void {
    void this.quickAdd.openDialog();
  }

  handleOpenAutoCount(): void {
    void this.quickAdd.openAutoCount();
  }

  handleOpenExerciseTimer(): void {
    void this.quickAdd.openExerciseTimer();
  }

  handleOpenStopwatch(): void {
    void this.quickAdd.openStopwatch();
  }

  handleFillToGoal(): void {
    void this.quickAdd.fillToGoal();
  }

  handleFabOpened(): void {
    if (this.speedDialCoachmarkVisible()) this.dismissSpeedDialCoachmark();
    this.appData.reloadAfterMutation();
  }

  /**
   * Toolbar "Tagesziel" pill click — when today's goal has already been
   * reached, replay the snap-celebration dialog on demand. The notifier
   * picks the right dialog kind (plan vs. daily) to match what the pill
   * is showing. No-op while the pill is still counting up to the goal.
   */
  handleGoalPillClick(): void {
    if (!this.goalReached()) {
      // Touch devices never fire the hover that opens the dropdown, so a tap
      // on the pill has to open the goal details itself.
      this.goalOverlay.show();
      return;
    }
    this._goalReachedNotifier.reopenPrimaryGoal();
  }

  // Angular's strictTemplates mode types `$event` for `(keydown.*)` key-
  // filter bindings as the base `Event` (no `.repeat`), so the WAI-ARIA
  // Button Pattern's auto-repeat guard can't live inline. The method also
  // accepts `Event` (not `KeyboardEvent`) so the template call passes
  // strict type-checking (TS2345); narrow via `instanceof` to read
  // `.repeat` safely.
  handleGoalPillKeydown(event: Event): void {
    if (event instanceof KeyboardEvent && event.repeat) return;
    this.handleGoalPillClick();
  }

  protected readonly reopenDailyAriaLabel = $localize`:@@toolbarDailyGoal.replayAria:Tagesziel-Animation erneut abspielen`;

  openFeedbackDialog(prefill = true): void {
    const data: FeedbackDialogData = prefill
      ? {
          name: this.auth.user()?.displayName ?? '',
          email: this.auth.user()?.email ?? '',
        }
      : {};

    const ref = this.dialog.open(FeedbackDialogComponent, {
      width: 'min(92vw, 480px)',
      maxWidth: '92vw',
      data,
    });

    ref.afterClosed().subscribe((result: FeedbackResult | undefined) => {
      if (!result) return;
      // Ensure at least guest auth so Firestore rules are satisfied
      this.authService
        .signInGuestIfNeeded()
        .then(() => {
          // Use synchronous currentUser (immediately available after auth op)
          // instead of signal-based userIdSafe() which may lag by a microtask.
          const userId = this.firebaseAuth?.currentUser?.uid ?? '';
          return this.feedbackService.submit(result, userId);
        })
        .then(() =>
          this.snackBar.open(
            $localize`:@@feedback.success:Danke für dein Feedback!`,
            '',
            { duration: 4000 }
          )
        )
        .catch(() =>
          this.snackBar.open(
            $localize`:@@feedback.error:Feedback konnte nicht gesendet werden.`,
            '',
            { duration: 4000 }
          )
        );
    });
  }

  async logout(): Promise<void> {
    this.reminderOrchestration.stop();
    await this.auth.logout();
    this.navOpen.set(false);
    await this.router.navigateByUrl('/');
  }

  private currentLeafRoute(): ActivatedRoute {
    let route = this.activatedRoute;
    while (route.firstChild) route = route.firstChild;
    return route;
  }

  private analyticsConsentGranted(): boolean {
    const storage = globalThis.localStorage;
    const hasGetItem = typeof storage?.getItem === 'function';
    if (!hasGetItem) return false;
    return storage.getItem('pus_analytics_consent') === 'granted';
  }

  private trackAnalytics(
    eventName: string,
    params: Record<string, string | number | boolean>
  ): void {
    if (!this.analytics || !this.analyticsConsentGranted()) return;
    logEvent(this.analytics, eventName, params);
  }
}
