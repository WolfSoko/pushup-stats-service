import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AdSlotComponent, AdsStore } from '@pu-stats/ads';
import { AuthService, AuthStore } from '@pu-auth/auth';
import {
  AI_ASSISTANT_CONFIG,
  AI_ASSISTANT_ROUTE,
  isAiAssistantEnabled,
} from '../../ai/ai-assistant.config';
import { InstallPromptService } from '../../core/install-prompt.service';
import { ReminderFeatureSectionComponent } from '../components/reminder-feature-section/reminder-feature-section.component';
import { SessionFeatureSectionComponent } from '../components/session-feature-section/session-feature-section.component';

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
    SessionFeatureSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly adsStore = inject(AdsStore);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly installPrompt = inject(InstallPromptService);
  private readonly router = inject(Router);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly authResolved = this.authStore.authResolved;
  readonly isGuest = this.authStore.isGuest;

  readonly canInstall = this.installPrompt.canInstall;
  readonly isStandalone = this.installPrompt.isStandalone;
  readonly showIosInstallHint = this.installPrompt.isIos;

  readonly adClient = this.adsStore.adClient;
  readonly landingAdSlot = this.adsStore.landingInlineSlot;

  readonly aiAssistantEnabled = isAiAssistantEnabled(
    inject(AI_ASSISTANT_CONFIG)
  );
  readonly aiAssistantLink = `/${AI_ASSISTANT_ROUTE}`;

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

  onAiAssistantCtaClick(): void {
    this.track('landing_ai_assistant_click', { target: 'assistant' });
  }

  onPlansCtaClick(target: 'overview' | 'signup'): void {
    this.track('landing_plans_cta_click', { target });
  }

  onSessionCtaClick(): void {
    this.track('landing_session_cta_click', { target: 'plans' });
  }

  async onInstallClick(): Promise<void> {
    const outcome = await this.installPrompt.prompt();
    this.track('landing_install_prompt', { outcome });
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
