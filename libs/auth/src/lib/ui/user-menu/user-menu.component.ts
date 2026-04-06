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
  readonly isGuest = this.state.isGuest;
  readonly error = this.state.error;

  readonly ariaUserMenu = $localize`:@@user.menu.aria:Nutzerkonto-Menü`;
  readonly ariaGuestMenu = $localize`:@@user.menu.guestAria:Gast-Menü`;
  readonly ariaAnonMenu = $localize`:@@user.menu.anonAria:Anmelde-Menü`;
  readonly guestLabel = $localize`:@@user.guestName:Gast`;

  async signIn(): Promise<boolean> {
    return this.router.navigate(['/login']);
  }

  async signOut(): Promise<void> {
    await this.state.logout();
  }

  async goToSettings(): Promise<void> {
    await this.router.navigate(['/settings']);
  }

  async tryAsGuest(): Promise<void> {
    const success = await this.state.tryAsGuest();
    if (success) {
      await this.router.navigate(['/app']);
    }
  }

  async convertToAccount(): Promise<void> {
    await this.router.navigate(['/register']);
  }
}
