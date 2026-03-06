import {
  Component,
  DestroyRef,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { SwUpdate, VersionDetectedEvent } from '@angular/service-worker';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore, UserMenuComponent } from '@pu-auth/auth';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserContextService } from './user-context.service';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom, filter } from 'rxjs';
import { SeoService } from './seo.service';
import { Analytics, logEvent } from '@angular/fire/analytics';

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
  private readonly userConfigApi = inject(UserConfigApiService);
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly auth = inject(AuthStore);

  setLanguage(lang: 'de' | 'en', ev?: Event): void {
    ev?.preventDefault();

    // Pin the language choice client-side. This avoids issues with service worker
    // navigation caching swallowing Set-Cookie headers.
    const maxAge = 180 * 24 * 60 * 60; // 180 days
    document.cookie = `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

    // No /de prefix in URL → DE is root.
    const target = lang === 'en' ? '/en/' : '/de';
    window.location.replace(target);
  }

  /** Whether the sidenav is open (same behavior on all screen sizes). */
  readonly navOpen = signal(false);

  readonly userGoalResource = resource({
    params: () => ({ userId: this.user.userIdSafe() }),
    loader: async ({ params }) =>
      firstValueFrom(this.userConfigApi.getConfig(params.userId)),
  });

  readonly dailyGoal = computed(
    () => this.userGoalResource.value()?.dailyGoal ?? 100
  );

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

        const title = data.seoTitle ?? 'Pushup Tracker';
        const description =
          data.seoDescription ??
          'Tracke Reps, Trends und Streaks mit Pushup Tracker.';

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
            $localize`Neue Version verfügbar`,
            $localize`Neu laden`,
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

  async logout(): Promise<void> {
    await this.auth.logout();
    this.navOpen.set(false);
    await this.router.navigateByUrl('/login');
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
