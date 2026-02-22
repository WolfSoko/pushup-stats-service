import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'pus-login',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
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
            <div class="providers">
              <button
                mat-raised-button
                (click)="signInWithGoogle()"
                [disabled]="loading()"
              >
                <mat-icon>g_mobiledata</mat-icon>
                Mit Google anmelden
              </button>

              <button
                mat-raised-button
                (click)="signInWithMicrosoft()"
                [disabled]="loading()"
              >
                <mat-icon>business</mat-icon>
                Mit Microsoft anmelden
              </button>

              <button
                mat-raised-button
                (click)="signInWithGitHub()"
                [disabled]="loading()"
              >
                <mat-icon>code</mat-icon>
                Mit GitHub anmelden
              </button>

              <button
                mat-raised-button
                (click)="signInWithApple()"
                [disabled]="loading()"
              >
                <mat-icon>phone_iphone</mat-icon>
                Mit Apple anmelden
              </button>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
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

      .providers {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 20px;
      }

      .providers button {
        display: flex;
        align-items: center;
        gap: 8px;
        justify-content: center;
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
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = this.authService.loading;
  readonly error = this.authService.error;

  async signInWithGoogle(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }

  async signInWithMicrosoft(): Promise<void> {
    try {
      await this.authService.signInWithMicrosoft();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }

  async signInWithGitHub(): Promise<void> {
    try {
      await this.authService.signInWithGitHub();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }

  async signInWithApple(): Promise<void> {
    try {
      await this.authService.signInWithApple();
      await this.router.navigate(['/']);
    } catch {
      // Error already handled by service
    }
  }
}
