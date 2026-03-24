import {
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AdSlotComponent, AdsConfigService } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import { LeaderboardPeriod, LeaderboardService } from '@pu-stats/data-access';
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
  private readonly leaderboardApi = inject(LeaderboardService, {
    optional: true,
  });
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly adsConfig = inject(AdsConfigService);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly isGuest = this.authStore.isGuest;

  readonly period = linkedSignal<LeaderboardPeriod>(() => 'daily');
  readonly adClient = this.adsConfig.adClient;
  readonly landingAdSlot = this.adsConfig.landingInlineSlot;

  readonly leaderboardResource = resource({
    loader: async () => {
      if (!this.leaderboardApi) {
        return {
          daily: { top: [], current: null },
          weekly: { top: [], current: null },
          monthly: { top: [], current: null },
        };
      }
      return this.leaderboardApi.load();
    },
  });

  readonly leaderboardEntries = computed(() => {
    const data = this.leaderboardResource.value();
    if (!data) return [];
    return data[this.period()].top;
  });

  readonly currentUserEntry = computed(() => {
    const data = this.leaderboardResource.value();
    if (!data) return null;
    return data[this.period()].current;
  });

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
