import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';

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
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  private readonly state = inject(AuthStore);
  private readonly router = inject(Router);

  readonly user = this.state.user;
  readonly loading = this.state.loading;
  readonly isAuthenticated = this.state.isAuthenticated;
  readonly error = this.state.error;

  async signIn(): Promise<boolean> {
    return this.router.navigate(['/login']);
  }

  async signOut(): Promise<void> {
    await this.state.logout();
  }
}
