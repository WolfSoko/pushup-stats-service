import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  TemplateRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  email,
  form,
  FormField,
  minLength,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ActivatedRoute, Router } from '@angular/router';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { AuthStore } from '../../core/state/auth.store';

export function hasStrongPasswordPolicy(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

const LoginState = signalStore(
  withState({
    hidePassword: true,
    isRegisterMode: false,
  }),
  withMethods((state) => ({
    toggleHidePassword: () =>
      patchState(state, { hidePassword: !state.hidePassword() }),
    toggleIsRegisterMode: () =>
      patchState(state, { isRegisterMode: !state.isRegisterMode() }),
  }))
);

@Component({
  selector: 'pus-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatCheckboxModule,
    FormField,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LoginState],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly functions = inject(Functions, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly userConfigApi = inject(UserConfigApiService);
  readonly authState = inject(AuthStore);
  readonly loginState = inject(LoginState);

  private readonly recaptchaSiteKey =
    '6LdIVoEsAAAAAMk4rJwg2DYHfM7ud_as7V5rUf4g';
  private readonly recaptchaAction = 'submit';

  loginData = signal({ email: '', password: '', repeatPassword: '' });
  recaptchaError = signal<string | null>(null);
  registerStep = signal<1 | 2 | 3 | 4 | 5>(1);
  registerDisplayName = signal('');
  registerDailyGoal = signal(100);
  registerConsentAccepted = signal(false);

  googleDisplayName = signal('');
  googleDailyGoal = signal(100);
  googleConsentAccepted = signal(false);
  googleWizardStep = signal(0);
  googleWizardError = signal<string | null>(null);
  private googleWizardDialogRef: MatDialogRef<unknown> | null = null;

  passwordPolicyValid = computed(() =>
    hasStrongPasswordPolicy(this.loginForm.password().value() || '')
  );
  passwordsMatch = computed(() => {
    if (!this.loginState.isRegisterMode()) return true;
    return (
      this.loginForm.password().value() ===
      this.loginForm.repeatPassword().value()
    );
  });

  loginForm = form(
    this.loginData,
    ({ email: emailAd, password, repeatPassword }) => {
      required(emailAd, {
        message: $localize`:@@validate.email.required:Bitte E-Mail eingeben!`,
      });
      email(emailAd, {
        message: $localize`:@@validate.email.email:Bitte gültige E-Mail eingeben!`,
      });
      required(password, {
        message: $localize`:@@validate.password.required:Bitte Passwort eingeben!`,
      });
      minLength(password, 8, {
        message: $localize`:@@validate.password.minLength:Passwort muss mindestens 8 Zeichen lang sein!`,
      });

      // Keep repeatPassword wired to form state (validation done context-aware in component).
      void repeatPassword;
    }
  );

  togglePasswordVisibility(): void {
    this.loginState.toggleHidePassword();
  }

  toggleMode(): void {
    this.loginState.toggleIsRegisterMode();
    this.registerStep.set(1);
    this.registerDisplayName.set('');
    this.registerDailyGoal.set(100);
    this.registerConsentAccepted.set(false);
    this.recaptchaError.set(null);
  }

  nextRegisterStep(): void {
    const step = this.registerStep();
    if (step === 1) {
      if (this.loginForm.email().invalid()) return;
      this.registerStep.set(2);
      return;
    }
    if (step === 2) {
      if (this.loginForm.password().invalid()) return;
      if (!this.passwordPolicyValid() || !this.passwordsMatch()) return;
      this.registerStep.set(3);
      return;
    }
    if (step === 3) {
      if (this.registerDisplayName().trim().length < 2) return;
      this.registerStep.set(4);
      return;
    }
    if (step === 4) {
      if (this.registerDailyGoal() < 1) return;
      this.registerStep.set(5);
    }
  }

  backRegisterStep(): void {
    this.registerStep.update((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5);
  }

  async signInWithEmail(): Promise<void> {
    if (
      this.loginForm.email().invalid() ||
      this.loginForm.password().invalid()
    ) {
      return;
    }

    if (this.loginState.isRegisterMode()) {
      if (this.registerStep() !== 5) {
        this.nextRegisterStep();
        return;
      }
      if (!this.passwordPolicyValid()) return;
      if (!this.passwordsMatch()) return;
      if (this.registerDisplayName().trim().length < 2) return;
      if (this.registerDailyGoal() < 1) return;
      if (!this.registerConsentAccepted()) return;
    }

    const { email, password } = this.loginForm().value();

    this.recaptchaError.set(null);
    const recaptchaOk = await this.verifyRecaptcha();
    if (!recaptchaOk) {
      this.recaptchaError.set(
        $localize`:@@recaptcha.failed:reCAPTCHA-Prüfung fehlgeschlagen. Bitte erneut versuchen.`
      );
      return;
    }

    try {
      if (this.loginState.isRegisterMode()) {
        await this.authState.signUpWithEmail(email, password);
        const user = this.authState.user();
        if (user?.uid) {
          await firstValueFrom(
            this.userConfigApi.updateConfig(user.uid, {
              displayName: this.registerDisplayName().trim(),
              dailyGoal: Math.max(1, Number(this.registerDailyGoal() || 100)),
              consent: {
                dataProcessing: true,
                statistics: true,
                targetedAds: true,
                acceptedAt: new Date().toISOString(),
              },
            })
          );
        }
      } else {
        await this.authState.signInWithEmail(email, password);
      }
      await this.router.navigateByUrl(this.targetUrl());
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGoogle(wizardTemplate: TemplateRef<unknown>): Promise<void> {
    try {
      await this.authState.login();

      const shouldShowWizard = await this.isGoogleOnboardingRequired();
      if (shouldShowWizard) {
        const completed = await this.openGoogleOnboardingWizard(wizardTemplate);
        if (!completed) {
          await this.authState.logout();
          return;
        }
      }

      await this.router.navigateByUrl(this.targetUrl());
    } catch {
      // Error already handled by service
    }
  }

  googleWizardNextFromName(): void {
    if (this.googleDisplayName().trim().length < 2) return;
    this.googleWizardStep.set(1);
  }

  googleWizardNextFromGoal(): void {
    if (this.googleDailyGoal() < 1) return;
    this.googleWizardStep.set(2);
  }

  googleWizardBack(): void {
    this.googleWizardStep.update((s) => Math.max(0, s - 1));
  }

  async completeGoogleOnboarding(): Promise<void> {
    this.googleWizardError.set(null);
    const user = this.authState.user();
    if (!user?.uid) {
      this.googleWizardError.set(
        $localize`:@@auth.onboarding.google.error.noUser:Kein eingeloggter Nutzer gefunden.`
      );
      return;
    }
    if (!this.googleConsentAccepted()) {
      this.googleWizardError.set(
        $localize`:@@auth.onboarding.google.error.consentRequired:Bitte stimme der Datenverarbeitung zu.`
      );
      return;
    }

    try {
      await firstValueFrom(
        this.userConfigApi.updateConfig(user.uid, {
          displayName: this.googleDisplayName().trim(),
          dailyGoal: Math.max(1, Number(this.googleDailyGoal() || 100)),
          consent: {
            dataProcessing: true,
            statistics: true,
            targetedAds: true,
            acceptedAt: new Date().toISOString(),
          },
        })
      );
      this.googleWizardDialogRef?.close('completed');
    } catch {
      this.googleWizardError.set(
        $localize`:@@auth.onboarding.google.error.saveFailed:Onboarding konnte nicht gespeichert werden. Bitte erneut versuchen.`
      );
    }
  }

  private async verifyRecaptcha(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.functions) {
      return false;
    }

    try {
      const token = await this.executeRecaptcha(this.recaptchaAction);
      const callAssessment = httpsCallable<
        { token: string; action: string },
        { ok: boolean; score: number; minScore: number; reasons?: string[] }
      >(this.functions, 'assessRecaptchaToken');

      const response = await callAssessment({
        token,
        action: this.recaptchaAction,
      });

      return response.data?.ok === true;
    } catch {
      // Fail-open on technical validation outages to avoid login lockouts.
      // Risk-based rejection still happens when the backend returns a valid response with ok=false.
      return true;
    }
  }

  private async executeRecaptcha(action: string): Promise<string> {
    const win = window as Window & {
      grecaptcha?: {
        enterprise?: {
          ready: (cb: () => void) => void;
          execute: (
            siteKey: string,
            options: { action: string }
          ) => Promise<string>;
        };
      };
    };

    const enterprise = win.grecaptcha?.enterprise;
    if (!enterprise) {
      throw new Error('reCAPTCHA Enterprise nicht verfügbar');
    }

    return new Promise<string>((resolve, reject) => {
      enterprise.ready(() => {
        enterprise
          .execute(this.recaptchaSiteKey, { action })
          .then(resolve)
          .catch(reject);
      });
    });
  }

  private async isGoogleOnboardingRequired(): Promise<boolean> {
    const user = this.authState.user();
    if (!user?.uid) return false;

    try {
      const cfg = await firstValueFrom(this.userConfigApi.getConfig(user.uid));
      return !cfg.displayName || !cfg.dailyGoal || !cfg.consent?.acceptedAt;
    } catch {
      return true;
    }
  }

  private async openGoogleOnboardingWizard(
    wizardTemplate: TemplateRef<unknown>
  ): Promise<boolean> {
    this.googleDisplayName.set(this.authState.user()?.displayName || '');
    this.googleDailyGoal.set(100);
    this.googleConsentAccepted.set(false);
    this.googleWizardStep.set(0);
    this.googleWizardError.set(null);

    this.googleWizardDialogRef = this.dialog.open(wizardTemplate, {
      disableClose: true,
      width: '540px',
    });

    const result = await firstValueFrom(
      this.googleWizardDialogRef.afterClosed()
    );
    this.googleWizardDialogRef = null;
    return result === 'completed';
  }

  validationMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return String(error ?? 'Ungültiger Wert');
  }

  private targetUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app';
  }
}
