import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
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
import { SwUpdate, VersionDetectedEvent } from '@angular/service-worker';
import { AuthService, AuthStore, UserMenuComponent } from '@pu-auth/auth';
import { filter } from 'rxjs';
import { SeoService } from './core/seo.service';
import { UserContextService } from '@pu-auth/auth';
import { PushSubscriptionService } from '@pu-reminders/reminders';
import { CookieConsentBannerComponent } from '@pu-stats/ads';
import { QuickAddFabComponent } from '@pu-stats/quick-add';
import { ThemeToggleComponent } from './core/theme';
import { ReminderOrchestrationService } from './core/reminder-orchestration.service';
import { AppDataFacade } from './core/app-data.facade';
import { QuickAddOrchestrationService } from './core/quick-add-orchestration.service';
import { FeedbackDialogComponent } from './core/feedback/feedback-dialog.component';
import { FeedbackService } from './core/feedback/feedback.service';
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
    MatListModule,
    MatDividerModule,
    UserMenuComponent,
    QuickAddFabComponent,
    ThemeToggleComponent,
    CookieConsentBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly feedbackService = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly user = inject(UserContextService);
  readonly isAdmin = computed(() => this.user.isAdmin());
  readonly isLoggedIn = computed(
    () => !!this.user.userIdSafe() && !this.user.isGuest()
  );
  private readonly pushService = inject(PushSubscriptionService);
  private readonly _initPushBridge = afterNextRender(() => {
    this.pushService.registerSwListener();
  });
  // Snooze param from SW notification click — must wait for auth to resolve
  // before calling the Cloud Function, otherwise the request goes out without
  // a Firebase Auth token and is rejected as 'unauthenticated'.
  private readonly _pendingSnooze = signal<number | null>(null);

  private static readonly EA_DISMISSED_KEY = 'pus_early_access_dismissed';

  private readonly _showEarlyAccessToast = afterNextRender(() => {
    try {
      if (localStorage.getItem(App.EA_DISMISSED_KEY) === '1') return;
    } catch {
      return;
    }

    const ref = this.snackBar.open(
      $localize`:@@earlyAccess.text:Early Access – pushup-stats.de befindet sich noch im Aufbau. Funktionen und Design können sich jederzeit ändern.`,
      $localize`:@@earlyAccess.feedback:Feedback`,
      {
        duration: 12_000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: 'early-access-snackbar',
      }
    );

    ref.onAction().subscribe(() => this.openFeedbackDialog(false));
    ref.afterDismissed().subscribe(() => {
      try {
        localStorage.setItem(App.EA_DISMISSED_KEY, '1');
      } catch {
        // localStorage unavailable
      }
    });
  });

  private readonly _handleSnoozeParam = afterNextRender(() => {
    const snooze = this.activatedRoute.snapshot.queryParamMap.get('snooze');
    const snoozeMinutes = snooze ? parseInt(snooze, 10) : NaN;
    if (!isNaN(snoozeMinutes) && snoozeMinutes > 0) {
      void this.router.navigate([], {
        queryParams: { snooze: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      this._pendingSnooze.set(snoozeMinutes);
    }
  });
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly auth = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly _snoozeWhenAuthReady = effect(() => {
    const snoozeMinutes = this._pendingSnooze();
    if (snoozeMinutes != null && this.auth.authResolved()) {
      this._pendingSnooze.set(null);
      this.pushService.snooze(snoozeMinutes).catch(() => {
        // Best-effort: if snooze fails (e.g. not authenticated),
        // the next reminder fires at the normal interval.
      });
    }
  });
  private readonly reminderOrchestration = inject(ReminderOrchestrationService);
  private readonly quickAdd = inject(QuickAddOrchestrationService);
  private readonly appData = inject(AppDataFacade);

  // Delegate to facade
  readonly quickAddSuggestions = this.appData.quickAddSuggestions;
  readonly dailyGoal = this.appData.dailyGoal;
  readonly todayProgress = this.appData.todayProgress;

  private readonly consentBanner =
    viewChild<CookieConsentBannerComponent>('consentBanner');

  openCookieSettings(): void {
    this.consentBanner()?.reopen();
  }

  setLanguage(lang: 'de' | 'en', ev?: Event): void {
    ev?.preventDefault();
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    // Preserve current page path when switching language
    const subPath = window.location.pathname.replace(/^\/(de|en)(\/|$)/, '/');
    const suffix = subPath === '/' ? '/' : subPath;
    const prefix = lang === 'en' ? '/en' : '/de';
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
        };

        const title =
          data.seoTitle ?? $localize`:@@seo.default.title:Pushup Tracker`;
        const description =
          data.seoDescription ??
          $localize`:@@seo.default.description:Tracke Reps, Trends und Streaks mit Pushup Tracker.`;

        const path = nav.urlAfterRedirects || nav.url;
        this.seo.update(title, description, path);
        this.trackAnalytics('page_view', { page_path: path });
      });

    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          if (event.type === 'VERSION_DETECTED') {
            this.showBackgroundUpdateToast(event);
            return;
          }

          if (event.type !== 'VERSION_READY') return;

          const ref = this.snackBar.open(
            $localize`:@@sw.update.available:Neue Version verfügbar`,
            $localize`:@@sw.update.reload:Neu laden`,
            {
              duration: 20_000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );

          ref.onAction().subscribe(() => {
            window.location.reload();
          });
        });
    }
  }

  handleQuickAdd(reps: number): void {
    this.quickAdd.add(reps);
  }

  handleOpenDialog(): void {
    this.quickAdd.openDialog();
  }

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
          const userId = this.user.userIdSafe();
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

  private showBackgroundUpdateToast(_event: VersionDetectedEvent): void {
    this.snackBar.open(
      $localize`:@@sw.update.downloading:Update wird im Hintergrund geladen …`,
      '',
      {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      }
    );
  }
}
