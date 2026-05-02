import { Component, inject } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AdSlotComponent, AdsStore } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import { ReminderFeatureSectionComponent } from '../components/reminder-feature-section/reminder-feature-section.component';

// Each string is 7 characters — one per day, top-to-bottom.
// 'e' = empty, '1'..'5' = intensity buckets (matches .lp-day-* SCSS).
const HEATMAP_PATTERN: readonly string[] = [
  '1e213e2',
  '2132e13',
  'e234231',
  '34234e2',
  '2354343',
  '423e354',
  '3435432',
  'e342543',
  '3523435',
  '43543e2',
  '2435433',
  '5343524',
  '3e35345',
  '453453e',
  '2453454',
  '3545435',
  '5454554',
  '45545e3',
];

@Component({
  selector: 'app-landing-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    AdSlotComponent,
    ReminderFeatureSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly adsStore = inject(AdsStore);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly authResolved = this.authStore.authResolved;
  readonly isGuest = this.authStore.isGuest;

  readonly adClient = this.adsStore.adClient;
  readonly landingAdSlot = this.adsStore.landingInlineSlot;

  // 18 weeks × 7 days, each char = day-class suffix.
  // 'e' = empty, '1'..'5' = intensity buckets (matches .lp-day-* SCSS).
  readonly heatmapWeeks = HEATMAP_PATTERN.map((row, i) => ({
    x: i * 14,
    days: row.split('').map((level, j) => ({
      y: j * 14,
      level: level === 'e' ? 'empty' : level,
    })),
  }));

  onCtaClick(target: 'signup' | 'login' | 'dashboard' | 'guest'): void {
    this.track('landing_cta_click', { target });
  }

  async onTryAsGuest(): Promise<void> {
    this.track('landing_cta_click', { target: 'guest' });
    await this.authService.signInGuestIfNeeded();
    await this.router.navigate(['/app']);
  }

  onDiscoverCardClick(target: 'leaderboard' | 'blog'): void {
    this.track('landing_discover_click', { target });
  }

  onPlanCardClick(planSlug: string): void {
    this.track('landing_plan_card_click', { plan: planSlug });
  }

  onPlansCtaClick(target: 'overview' | 'signup'): void {
    this.track('landing_plans_cta_click', { target });
  }

  private track(
    eventName: string,
    params: Record<string, string | number | boolean>
  ): void {
    if (!this.analytics || !this.analyticsConsentGranted()) return;
    logEvent(this.analytics, eventName, params);
  }

  private analyticsConsentGranted(): boolean {
    const storage = globalThis.localStorage;
    const hasGetItem = typeof storage?.getItem === 'function';
    if (!hasGetItem) return false;
    return storage.getItem('pus_analytics_consent') === 'granted';
  }
}
