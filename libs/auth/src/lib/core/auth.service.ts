import { computed, inject, Injectable, signal } from '@angular/core';
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

    try {
      await this.authAdapter.signInWithGoogle();
    } catch (err) {
      this.error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Google sign-in error:', err);
      throw err;
    } finally {
    }
  }

  /** Sign out */
  async signOut(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await this.authAdapter.signOut();
    } catch (err) {
      this.error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Sign-out error:', err);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

}
