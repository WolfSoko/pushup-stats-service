import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Willkommen bei PushUp Stats</mat-card-title>
          <mat-card-subtitle>Bitte melde dich an</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <div class="error-message">
              <mat-icon color="warn">error</mat-icon>
              <span>{{ error()?.message }}</span>
            </div>
          }

          @if (loading()) {
            <div class="loading" aria-busy="true">
              <mat-spinner diameter="40" aria-label="Anmelden..."></mat-spinner>
              <span>Anmelden...</span>
            </div>
          } @else {
            <!-- Email/Password Form -->
            <form [formGroup]="loginForm" (ngSubmit)="signInWithEmail()" class="login-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" placeholder="deine@email.de" />
                <mat-icon matSuffix>email</mat-icon>
                @if (loginForm.get('email')?.hasError('required')) {
                  <mat-error>Email ist erforderlich</mat-error>
                }
                @if (loginForm.get('email')?.hasError('email')) {
                  <mat-error>Ungültige Email-Adresse</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Passwort</mat-label>
                <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" />
                <button mat-icon-button type="button" matSuffix (click)="togglePasswordVisibility()" tabindex="-1">
                  <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (loginForm.get('password')?.hasError('required')) {
                  <mat-error>Passwort ist erforderlich</mat-error>
                }
                @if (loginForm.get('password')?.hasError('minlength')) {
                  <mat-error>Mindestens 6 Zeichen</mat-error>
                }
              </mat-form-field>

              <button mat-raised-button color="primary" type="submit" [disabled]="loginForm.invalid || loading()" class="full-width login-button">
                <mat-icon>login</mat-icon>
                Anmelden
              </button>
            </form>

            <div class="divider">
              <span>oder</span>
            </div>

            <!-- Google Sign In -->
            <button mat-raised-button (click)="signInWithGoogle()" [disabled]="loading()" class="full-width google-button">
              <mat-icon svgIcon="google"></mat-icon>
              Mit Google anmelden
            </button>

            <!-- Toggle Register/Login -->
            <div class="toggle-mode">
              @if (isRegisterMode()) {
                <span>Bereits registriert?</span>
                <button mat-button type="button" (click)="toggleMode()">Zum Login</button>
              } @else {
                <span>Noch kein Account?</span>
                <button mat-button type="button" (click)="toggleMode()">Registrieren</button>
              }
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .login-card {
      max-width: 400px;
      width: 100%;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
    }

    .full-width {
      width: 100%;
    }

    .login-button,
    .google-button {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
      height: 48px;
    }

    .google-button {
      background-color: #fff;
      color: #444;
      border: 1px solid #ddd;
    }

    .google-button:hover {
      background-color: #f8f8f8;
    }

    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #666;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #ddd;
    }

    .divider span {
      padding: 0 12px;
      font-size: 14px;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      padding: 12px;
      background: #ffebee;
      border-radius: 4px;
      margin-bottom: 16px;
    }

    .toggle-mode {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 20px;
      color: #666;
      font-size: 14px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;

  hidePassword = signal(true);
  isRegisterMode = signal(false);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  toggleMode(): void {
    this.isRegisterMode.update((v) => !v);
    this.loginForm.reset();
  }

  async signInWithEmail(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;
    if (!email || !password) return;

    try {
      if (this.isRegisterMode()) {
        await this.authService.signUpWithEmail(email, password);
      } else {
        await this.authService.signInWithEmail(email, password);
      }
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }
}
