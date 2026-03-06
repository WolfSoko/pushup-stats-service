import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/state/auth.store';

export function hasStrongPasswordPolicy(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

const LoginState = signalStore(
  withState({
    hidePassword: true,
  }),
  withMethods((state) => ({
    toggleHidePassword: () =>
      patchState(state, { hidePassword: !state.hidePassword() }),
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
  private readonly dialog = inject(MatDialog);
  private readonly userConfigApi = inject(UserConfigApiService);
  readonly authState = inject(AuthStore);
  readonly loginState = inject(LoginState);

  loginData = signal({ email: '', password: '' });

  googleDisplayName = signal('');
  googleDailyGoal = signal(100);
  googleConsentAccepted = signal(false);
  googleWizardStep = signal(0);
  googleWizardError = signal<string | null>(null);
  private googleWizardDialogRef: MatDialogRef<unknown> | null = null;

  loginForm = form(this.loginData, ({ email: emailAd, password }) => {
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
  });

  togglePasswordVisibility(): void {
    this.loginState.toggleHidePassword();
  }

  async goToRegister(): Promise<void> {
    await this.router.navigateByUrl('/register');
  }

  async signInWithEmail(): Promise<void> {
    if (
      this.loginForm.email().invalid() ||
      this.loginForm.password().invalid()
    ) {
      return;
    }

    const { email, password } = this.loginForm().value();

    try {
      await this.authState.signInWithEmail(email, password);
      if (!this.authState.isAuthenticated()) {
        return;
      }
      await this.router.navigateByUrl(this.targetUrl());
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGoogle(wizardTemplate: TemplateRef<unknown>): Promise<void> {
    try {
      await this.authState.login();
      if (!this.authState.isAuthenticated()) {
        return;
      }

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
