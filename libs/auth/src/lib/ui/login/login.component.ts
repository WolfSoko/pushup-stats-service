import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { Router } from '@angular/router';
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
  readonly authState = inject(AuthStore);
  readonly loginState = inject(LoginState);

  loginData = signal({ email: '', password: '' });

  loginForm = form(this.loginData, ({ email: emailAd, password }) => {
    required(emailAd, {
      message: $localize`:@@validate.email.required:Bitte Email eingeben!`,
    });
    email(emailAd, {
      message: $localize`:@@validate.email.email:Bitte gültige Email eingeben!`,
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

    try {
      if (this.loginState.isRegisterMode()) {
        await this.authState.signUpWithEmail(email, password);
      } else {
        await this.authState.signInWithEmail(email, password);
      }
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.authState.login();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }
}
