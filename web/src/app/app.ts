import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
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
import { AuthStore, UserMenuComponent } from '@pu-auth/auth';
import { StatsApiService } from '@pu-stats/data-access';
import { filter } from 'rxjs';
import { SeoService } from './core/seo.service';
import { UserContextService } from '@pu-auth/auth';
import { PushSubscriptionService } from '@pu-reminders/reminders';
import {
  QuickAddBridgeService,
  QuickAddFabComponent,
} from '@pu-stats/quick-add';
import { ThemeToggleComponent } from './core/theme';
import { ReminderOrchestrationService } from './core/reminder-orchestration.service';
import { AppDataFacade } from './core/app-data.facade';

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
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
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
  private readonly _handleSnoozeParam = afterNextRender(() => {
    const snooze = this.activatedRoute.snapshot.queryParamMap.get('snooze');
    const snoozeMinutes = snooze ? parseInt(snooze, 10) : NaN;
    if (!isNaN(snoozeMinutes) && snoozeMinutes > 0) {
      void this.router.navigate([], {
        queryParams: { snooze: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      void this.pushService.snooze(snoozeMinutes);
    }
  });
  private readonly statsApi = inject(StatsApiService);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly auth = inject(AuthStore);
  private readonly reminderOrchestration = inject(ReminderOrchestrationService);
  private readonly quickAddBridge = inject(QuickAddBridgeService);
  private readonly appData = inject(AppDataFacade);

  // Delegate to facade
  readonly quickAddSuggestions = this.appData.quickAddSuggestions;
  readonly dailyGoal = this.appData.dailyGoal;
  readonly todayProgress = this.appData.todayProgress;

  setLanguage(lang: 'de' | 'en', ev?: Event): void {
    ev?.preventDefault();
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    const target = lang === 'en' ? '/en/' : '/de';
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
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${y}-${m}-${d}T${hh}:${mm}`;
    this.statsApi
      .createPushup({ timestamp, reps, source: 'quick-add' })
      .subscribe({
        next: () => {
          this.snackBar.open(
            $localize`:@@quickAdd.success.create:Eintrag gespeichert.`,
            '',
            {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          );
          this.appData.reloadAfterQuickAdd();
        },
        error: () =>
          this.snackBar.open(
            $localize`:@@quickAdd.error.create:Eintrag konnte nicht gespeichert werden.`,
            '',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom',
            }
          ),
      });
  }

  handleOpenDialog(): void {
    const currentPath = this.router.url.split('?')[0];
    if (currentPath === '/app' || currentPath.startsWith('/app/')) {
      this.quickAddBridge.requestOpenDialog();
    } else {
      void this.router.navigate(['/app']).then(
        (navigated) => {
          if (navigated) {
            this.quickAddBridge.requestOpenDialog();
          }
        },
        () => {
          // Navigation failed or was cancelled; do not open the dialog.
        }
      );
    }
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
