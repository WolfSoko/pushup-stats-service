import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
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
import { ActivatedRoute, Router } from '@angular/router';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { AuthStore } from '../../core/state/auth.store';

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
  readonly authState = inject(AuthStore);
  readonly loginState = inject(LoginState);

  private readonly recaptchaSiteKey =
    '6LdIVoEsAAAAAMk4rJwg2DYHfM7ud_as7V5rUf4g';
  private readonly recaptchaAction = 'submit';

  loginData = signal({ email: '', password: '' });
  recaptchaError = signal<string | null>(null);

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
    minLength(password, 6, {
      message: $localize`:@@validate.password.minLength:Passwort muss mindestens 6 Zeichen lang sein!`,
    });
  });

  togglePasswordVisibility(): void {
    this.loginState.toggleHidePassword();
  }

  toggleMode(): void {
    this.loginState.toggleIsRegisterMode();
  }

  async signInWithEmail(): Promise<void> {
    if (this.loginForm().invalid()) return;

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
      } else {
        await this.authState.signInWithEmail(email, password);
      }
      await this.router.navigateByUrl(this.targetUrl());
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.authState.login();
      await this.router.navigateByUrl(this.targetUrl());
    } catch {
      // Error already handled by service
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

  private targetUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app';
  }
}
