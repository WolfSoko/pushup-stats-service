import { inject, Injectable } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';

export const REGISTRATION_STEPS = [
  'email',
  'password',
  'username',
  'daily_goal',
  'consent',
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

type RegistrationVariant = { is_google: boolean };

type RegistrationFailureReason = 'sign_up' | 'persist_profile';

@Injectable({ providedIn: 'root' })
export class RegistrationAnalyticsService {
  private readonly analytics = inject(Analytics, { optional: true });

  trackStarted(params: { plan_preselected: boolean }): void {
    this.track('register_started', params);
  }

  trackStepView(step: RegistrationStep, variant: RegistrationVariant): void {
    this.track('register_step_view', {
      step_name: step,
      step_index: REGISTRATION_STEPS.indexOf(step),
      is_google: variant.is_google,
    });
  }

  trackStepCompleted(
    step: RegistrationStep,
    variant: RegistrationVariant
  ): void {
    this.track('register_step_completed', {
      step_name: step,
      step_index: REGISTRATION_STEPS.indexOf(step),
      is_google: variant.is_google,
    });
  }

  trackSubmitted(variant: RegistrationVariant): void {
    this.track('register_submitted', variant);
  }

  trackSucceeded(variant: RegistrationVariant): void {
    this.track('register_succeeded', variant);
  }

  trackFailed(
    variant: RegistrationVariant & { reason: RegistrationFailureReason }
  ): void {
    this.track('register_failed', variant);
  }

  trackAbandoned(
    params: RegistrationVariant & { last_step: RegistrationStep }
  ): void {
    this.track('register_abandoned', {
      ...params,
      last_step_index: REGISTRATION_STEPS.indexOf(params.last_step),
    });
  }

  private consentGranted(): boolean {
    const storage = globalThis.localStorage;
    if (typeof storage?.getItem !== 'function') return false;
    return storage.getItem('pus_analytics_consent') === 'granted';
  }

  private track(
    eventName: string,
    params: Record<string, string | number | boolean>
  ): void {
    if (!this.analytics || !this.consentGranted()) return;
    logEvent(this.analytics, eventName, params);
  }
}
