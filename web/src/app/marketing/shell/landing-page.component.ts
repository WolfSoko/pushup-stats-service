import { Component, computed, inject, linkedSignal } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AdSlotComponent, AdsStore } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import { LeaderboardPeriod, LeaderboardStore } from '@pu-stats/data-access';
import { ReminderFeatureSectionComponent } from '../components/reminder-feature-section/reminder-feature-section.component';

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
  private readonly store = inject(LeaderboardStore);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly adsStore = inject(AdsStore);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly authResolved = this.authStore.authResolved;
  readonly isGuest = this.authStore.isGuest;

  readonly period = linkedSignal<LeaderboardPeriod>(() => 'daily');
  readonly adClient = this.adsStore.adClient;
  readonly landingAdSlot = this.adsStore.landingInlineSlot;

  readonly leaderboardEntries = this.store.entriesForPeriod(this.period);
  readonly currentUserEntry = this.store.currentUserForPeriod(this.period);

  readonly leaderboardSlots = computed(() => {
    const top = this.leaderboardEntries();
    return Array.from({ length: 10 }, (_, index) => {
      const entry = top[index];
      return (
        entry ?? {
          alias: '—',
          reps: 0,
          rank: index + 1,
        }
      );
    });
  });

  constructor() {
    this.store.load();
  }

  onCtaClick(target: 'signup' | 'login' | 'dashboard' | 'guest'): void {
    this.track('landing_cta_click', { target });
  }

  async onTryAsGuest(): Promise<void> {
    this.track('landing_cta_click', { target: 'guest' });
    await this.authService.signInGuestIfNeeded();
    await this.router.navigate(['/app']);
  }

  onPeriodChange(period: LeaderboardPeriod): void {
    this.period.set(period);
    this.track('landing_leaderboard_period_change', { period });
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
