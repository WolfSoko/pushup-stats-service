import { computed, inject, Injectable } from '@angular/core';
import { AuthAdapter } from '../adapters/auth.adapter';
import { mapAuthUserToPUSUser } from '../map-auth-user-to-user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authAdapter = inject(AuthAdapter);

  readonly user = computed(() =>
    mapAuthUserToPUSUser(this.authAdapter.authUser())
  );
  readonly isAuthenticated = this.authAdapter.isAuthenticated;
  readonly idToken = this.authAdapter.idToken;

  /** Sign in with Google */
  async signInWithGoogle(): Promise<void> {
    await this.wrapAsync(
      () => this.authAdapter.signInWithGoogle(),
      'Google sign-in'
    );
  }

  /** Sign in with email and password */
  async signInWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(
      () => this.authAdapter.signInWithEmail(email, password),
      'Email sign-in'
    );
  }

  /** Sign up with email and password */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(
      () => this.authAdapter.signUpWithEmail(email, password),
      'Email sign-up'
    );
  }

  /** Sign out (alias for logout) */
  async signOut(): Promise<void> {
    await this.logout();
  }

  /** Logout */
  async logout(): Promise<void> {
    await this.wrapAsync(() => this.authAdapter.signOut(), 'Sign-out');
  }

  private async wrapAsync<T>(
    fn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[AuthService] ${operation} error:`, err);
      throw error;
    }
  }

}
