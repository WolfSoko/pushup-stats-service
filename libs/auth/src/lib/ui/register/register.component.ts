import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatStepper,
  MatStepperModule,
  StepperOrientation,
} from '@angular/material/stepper';
import { ActivatedRoute, Router } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom, map, Observable } from 'rxjs';
import { AuthStore } from '../../core/state/auth.store';
import { hasStrongPasswordPolicy } from '../login/login.component';

const RegisterState = signalStore(
  withState({
    hidePassword: true,
  }),
  withMethods((state) => ({
    toggleHidePassword: () =>
      patchState(state, { hidePassword: !state.hidePassword() }),
  }))
);

@Component({
  selector: 'pus-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatStepperModule,
    FormField,
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RegisterState],
})
export class RegisterComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userConfigApi = inject(UserConfigApiService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly authState = inject(AuthStore);
  readonly registerState = inject(RegisterState);

  registerData = signal({ email: '', password: '', repeatPassword: '' });
  registerDisplayName = signal('');
  registerDailyGoal = signal(100);
  registerConsentAccepted = signal(false);
  registeringCredentials = signal(false);
  registerSuccess = signal(false);

  stepperOrientation: Observable<StepperOrientation> = this.breakpointObserver
    .observe('(min-width: 800px)')
    .pipe(map(({ matches }) => (matches ? 'horizontal' : 'vertical')));

  passwordPolicyValid = computed(() =>
    hasStrongPasswordPolicy(this.registerForm.password().value() || '')
  );

  passwordsMatch = computed(
    () =>
      this.registerForm.password().value() ===
      this.registerForm.repeatPassword().value()
  );

  registerForm = form(this.registerData, ({ email: emailAd, password }) => {
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
    this.registerState.toggleHidePassword();
  }

  async goToLogin(): Promise<void> {
    if (this.authState.isAuthenticated()) {
      await this.authState.logout();
    }
    this.registerSuccess.set(false);
    await this.router.navigateByUrl('/login');
  }

  async completeCredentialStep(stepper: MatStepper): Promise<void> {
    if (
      this.registerForm.email().invalid() ||
      this.registerForm.password().invalid()
    ) {
      return;
    }
    if (!this.passwordPolicyValid() || !this.passwordsMatch()) {
      return;
    }

    this.registeringCredentials.set(true);
    await new Promise((resolve) => setTimeout(resolve, 450));
    this.registeringCredentials.set(false);
    stepper.next();
  }

  async submitEmailRegistration(): Promise<void> {
    if (
      this.registerForm.email().invalid() ||
      this.registerForm.password().invalid()
    ) {
      return;
    }
    if (!this.passwordPolicyValid() || !this.passwordsMatch()) return;
    if (this.registerDisplayName().trim().length < 2) return;
    if (this.registerDailyGoal() < 1) return;
    if (!this.registerConsentAccepted()) return;

    const { email, password } = this.registerForm().value();

    try {
      this.registeringCredentials.set(true);
      this.registerSuccess.set(false);

      await this.authState.signUpWithEmail(email, password);
      if (!this.authState.isAuthenticated()) {
        this.registeringCredentials.set(false);
        return;
      }

      const uid = this.authState.user()?.uid;
      if (!uid) {
        this.registeringCredentials.set(false);
        return;
      }

      await firstValueFrom(
        this.userConfigApi.updateConfig(uid, {
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

      this.registerSuccess.set(true);
      this.registeringCredentials.set(false);
    } catch {
      this.registeringCredentials.set(false);
    }
  }

  async goToDashboard(): Promise<void> {
    await this.router.navigateByUrl(this.targetUrl());
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
