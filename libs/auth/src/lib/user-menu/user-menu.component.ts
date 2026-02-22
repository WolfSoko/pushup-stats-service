import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'pus-user-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressSpinner,
  ],
  template: `
    @if (loading()) {
      <mat-spinner diameter="24"></mat-spinner>
    } @else if (isAuthenticated()) {
      <button
        mat-icon-button
        [matMenuTriggerFor]="userMenu"
        aria-label="User menu"
      >
        @if (user()?.photoURL) {
          <img [src]="user()!.photoURL" alt="Avatar" class="avatar-img" />
        } @else {
          <mat-icon>account_circle</mat-icon>
        }
      </button>

      <mat-menu #userMenu="matMenu">
        <div class="user-info">
          <span class="display-name">{{
            user()?.displayName || user()?.email || 'Benutzer'
          }}</span>
          <span class="email">{{ user()?.email }}</span>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="signOut()">
          <mat-icon>logout</mat-icon>
          <span>Abmelden</span>
        </button>
      </mat-menu>
    } @else {
      <button mat-raised-button color="primary" (click)="signIn()">
        <mat-icon>login</mat-icon>
        Anmelden
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
      }

      .avatar-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }

      .user-info {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        min-width: 200px;
      }

      .display-name {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .email {
        font-size: 12px;
        opacity: 0.7;
      }

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly loading = this.authService.loading;
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly error = this.authService.error;

  async signIn(): Promise<boolean> {
    return this.router.navigate(['/login']);
  }

  async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      // Stay on current page after logout
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
}
