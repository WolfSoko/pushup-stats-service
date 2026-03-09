import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
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
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GoogleOnboardingDialogComponent } from './google-onboarding-dialog/google-onboarding-dialog.component';
import { LoginUiStore } from './login-ui.store';

export function hasStrongPasswordPolicy(value: string): boolean {
  return /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
}

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
  providers: [LoginUiStore],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  readonly loginUiStore = inject(LoginUiStore);

  private readonly loginData = signal({ email: '', password: '' });
  readonly loginForm = form(
    this.loginData,
    ({ email: emailControl, password }) => {
      required(emailControl, {
        message: $localize`:@@validate.email.required:Bitte E-Mail eingeben!`,
      });
      email(emailControl, {
        message: $localize`:@@validate.email.email:Bitte gültige E-Mail eingeben!`,
      });
      required(password, {
        message: $localize`:@@validate.password.required:Bitte Passwort eingeben!`,
      });
      minLength(password, 8, {
        message: $localize`:@@validate.password.minLength:Passwort muss mindestens 8 Zeichen lang sein!`,
      });
    }
  );

  async goToRegister(): Promise<void> {
    await this.router.navigateByUrl('/register');
  }

  async signInWithEmail(): Promise<void> {
    if (this.loginForm.email().invalid() || this.loginForm.password().invalid())
      return;
    const { email, password } = this.loginForm().value();
    if (await this.loginUiStore.signInWithEmail(email, password)) {
      await this.router.navigateByUrl(this.targetUrl());
    }
  }

  async signInWithGoogle(): Promise<void> {
    if (!(await this.loginUiStore.signInWithGoogle())) return;
    if (await this.loginUiStore.isGoogleOnboardingRequired()) {
      this.loginUiStore.resetWizard(this.loginUiStore.currentUserDisplayName());
      const dialogRef = this.dialog.open(GoogleOnboardingDialogComponent, {
        disableClose: true,
        width: '540px',
        injector: this.injector,
      });
      const result = await firstValueFrom(dialogRef.afterClosed());
      if (result !== 'completed') {
        await this.loginUiStore.logout();
        return;
      }
    }
    await this.router.navigateByUrl(this.targetUrl());
  }

  validationMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error)
      return String((error as { message: unknown }).message);
    return String(error ?? 'Ungültiger Wert');
  }

  private targetUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') ?? '/app';
  }
}
