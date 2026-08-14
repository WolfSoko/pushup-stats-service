import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  LOCALE_ID,
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
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
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
import { AuthService, AuthStore, UserMenuComponent } from '@pu-auth/auth';
import { filter } from 'rxjs';
import { AiAssistantNavButtonComponent } from './ai/ai-assistant-nav-button.component';
import { SeoService } from './core/seo.service';
import { FeatureFlagsService, UserContextService } from '@pu-auth/auth';
import {
  PushIntentDrainService,
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
import { SwUpdateService } from './core/sw-update.service';
import { AppDataFacade } from './core/app-data.facade';
import { QuickAddOrchestrationService } from './core/quick-add-orchestration.service';
import { GoalReachedNotificationService } from './core/goal-reached-notification.service';
import { FeedbackDialogComponent } from './core/feedback/feedback-dialog.component';
import { FeedbackService } from './core/feedback/feedback.service';
import {
  FeedbackDialogData,
  FeedbackResult,
} from './core/feedback/feedback.models';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../server-locale-redirect';

interface LanguageOption {
  readonly code: SupportedLocale;
  readonly label: string;
}

/**
 * Language switcher options. Labels are the language's self-name so a
 * speaker of any language can recognise their entry, regardless of the
 * UI's current locale. Hardcoded — these strings are language proper
 * names, not UI copy that needs translation.
 */
const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'no', label: 'Norsk' },
  { code: 'zh', label: '中文' },
];

/**
 * Coerce an Angular `LOCALE_ID` (which can arrive as `en-US`, `de-DE`,
 * etc. in dev / test builds) to one of the codes we know how to render.
 * Falls back to the source locale (`de`) when the runtime tag doesn't
 * match any supported language.
 */
function resolveCurrentLocale(localeId: string): SupportedLocale {
  const lower = localeId.toLowerCase();
  return (
    SUPPORTED_LOCALES.find(
      (code) => lower === code || lower.startsWith(`${code}-`)
    ) ?? 'de'
  );
}

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
    MatListModule,
    MatDividerModule,
    UserMenuComponent,
    QuickAddFabComponent,
    QuickAddFabCoachmarkComponent,
    ThemeToggleComponent,
    AiAssistantNavButtonComponent,
    DailyGoalChecklistComponent,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    OverlayModule,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
})
export class App {
  private readonly swUpdate = inject(SwUpdateService);
  /** Drives the persistent "new version" button in the toolbar. */
  readonly swUpdateAvailable = this.swUpdate.updateAvailable;
  readonly swUpdateUnrecoverable = this.swUpdate.unrecoverable;
  protected readonly swUpdateAriaLabel = $localize`:@@sw.update.buttonAria:Neue Version verfügbar – jetzt neu laden`;
  protected readonly swUpdateRecoverAriaLabel = $localize`:@@sw.update.recoverButtonAria:App-Daten beschädigt – jetzt neu laden`;
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
  // The speed-dial FAB is for anyone who can persist an entry — guests have a
  // real (anonymous) auth uid and can quick-add too, so it shows for them as
  // well, unlike the reminders nav which is gated to signed-in accounts.
  readonly showQuickAddFab = computed(() => !!this.user.userIdSafe());
  private readonly pushService = inject(PushSubscriptionService);
  private readonly pushSwRegistration = inject(PushSwRegistrationService);
  private readonly pushIntents = inject(PushIntentDrainService);
  // Eagerly register the push service worker on boot so:
  //   - fresh visitors have the SW installed before they ever open /reminders
  //     (no cold-start race on the first `subscribe()` click), and
  //   - existing subscribers pull the latest `sw-push.js` via the browser's
  //     update check even when they never navigate to /reminders.
  // Lives next to `registerSwListener()` which wires the `message` bridge
  // for PUSH_SUBSCRIPTION_CHANGED events fired by the push SW.
  private readonly _initPushBridge = afterNextRender(() => {
    this.pushService.registerSwListener();
    this.pushIntents.init();
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
  // Eager-inject so the Android closed-test invite popup can fire regardless
  // of which page is mounted.
  private readonly _androidTestInvite = inject(
    AndroidTestInviteOrchestrationService
  );

  // Delegate to facade
  readonly quickAddSuggestions = this.appData.quickAddSuggestions;
  readonly dailyGoal = this.appData.dailyGoal;
  readonly todayProgress = this.appData.todayProgress;
  readonly remainingToGoal = this.appData.remainingToGoal;
  readonly goalReached = this.appData.goalReached;
  /**
   * Aggregated daily-goal completion (0–100). Drives the toolbar pill
   * label when the user has configured complex goals — falls back to
   * the legacy `progress / target` reps display when no complex goals
   * apply today.
   */
  readonly dailyGoalAggregatedPercent = this.appData.dailyGoalAggregatedPercent;
  readonly hasComplexDailyGoals = computed(
    () =>
      this.appData.complexGoalsEnabled() &&
      this.appData.todayGoalEntries().length > 0
  );
  /**
   * Per-exercise breakdown for the toolbar pill's hover/touch dropdown.
   * Lists every daily goal (or the active plan's prescribed reps) with its
   * target, progress and completion share.
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
  readonly fillToGoalInFlight = this.quickAdd.fillToGoalInFlight;

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

  /** Locale options shown in the sidenav language picker. */
  readonly languageOptions = LANGUAGE_OPTIONS;
  /**
   * The currently active locale. `LOCALE_ID` in dev/test builds may
   * arrive as `'en-US'` or another extended tag, so we coerce to the
   * matching short code or fall back to the source locale.
   */
  readonly currentLocale: SupportedLocale = resolveCurrentLocale(
    inject(LOCALE_ID)
  );

  setLanguage(lang: SupportedLocale, ev?: Event): void {
    ev?.preventDefault();
    this.navOpen.set(false);
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    // Preserve current page path when switching language. Strip any
    // existing locale prefix (one of SUPPORTED_LOCALES) and prepend
    // the new one. The alternation regex is rebuilt from the locale
    // list so adding a locale only requires updating one constant.
    const localesAlt = SUPPORTED_LOCALES.join('|');
    const stripPrefix = new RegExp(`^/(?:${localesAlt})(/|$)`);
    const subPath = window.location.pathname.replace(stripPrefix, '/');
    const suffix = subPath === '/' ? '/' : subPath;
    const prefix = `/${lang}`;
    const target = `${prefix}${suffix}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }

  /** Whether the sidenav is open (same behavior on all screen sizes). */
  readonly navOpen = signal(false);

  constructor() {
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
          data.seoTitle ?? $localize`:@@seo.default.title:Pushup Tracker`;
        const description =
          data.seoDescription ??
          $localize`:@@seo.default.description:Tracke Reps, Trends und Streaks mit Pushup Tracker.`;

        const path = nav.urlAfterRedirects || nav.url;
        this.seo.update(title, description, path, { noindex: data.noindex });
        this.trackAnalytics('page_view', { page_path: path });
      });
  }

  applyServiceWorkerUpdate(): void {
    void this.swUpdate.applyUpdate();
  }

  handleQuickAdd(suggestion: QuickAddSuggestion): void {
    this.quickAdd.addSuggestion(suggestion);
  }

  handleOpenDialog(): void {
    this.quickAdd.openDialog();
  }

  handleOpenAutoCount(): void {
    this.quickAdd.openAutoCount();
  }

  handleOpenExerciseTimer(): void {
    this.quickAdd.openExerciseTimer();
  }

  handleFillToGoal(): void {
    this.quickAdd.fillToGoal();
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
