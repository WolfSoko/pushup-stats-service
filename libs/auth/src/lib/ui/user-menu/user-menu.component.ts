import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { SkeletonComponent } from '@pu-stats/ui';
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
    SkeletonComponent,
  ],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  private readonly state = inject(AuthStore);
  private readonly router = inject(Router);

  /**
   * Overrides the identity provider's picture. This library knows nothing
   * about uploaded photos — they live in the app's user config — so the
   * host supplies the resolved URL and the default keeps the previous
   * behaviour for anyone who does not.
   */
  readonly avatarUrl = input<string | null>(null);

  /**
   * Unread inbox count, supplied by the host for the same reason as
   * {@link avatarUrl}: this library must not reach into the app's
   * notification store, which would invert the dependency.
   */
  readonly unreadNotifications = input<number>(0);

  readonly user = this.state.user;
  readonly loading = this.state.loading;
  readonly isAuthenticated = this.state.isAuthenticated;
  readonly isGuest = this.state.isGuest;
  readonly error = this.state.error;

  readonly avatar = computed(
    () => this.avatarUrl() ?? this.user()?.photoURL ?? null
  );

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

  /**
   * Opens the user's own public profile. Falls back to the settings tab
   * when there is no uid yet (auth still resolving) rather than routing
   * to `/u/` with an empty segment.
   */
  async goToProfile(): Promise<void> {
    const uid = this.user()?.uid;
    await this.router.navigate(uid ? ['/u', uid] : ['/settings', 'profil']);
  }

  async goToSettings(): Promise<void> {
    await this.router.navigate(['/settings']);
  }

  async goToNotifications(): Promise<void> {
    await this.router.navigate(['/nachrichten']);
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
