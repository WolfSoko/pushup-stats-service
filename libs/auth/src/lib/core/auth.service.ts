import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { computed, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthAdapter } from '../adapters/auth.adapter';
import { mapAuthUserToPUSUser } from '../map-auth-user-to-user';
import { UserConfigApiService } from '@pu-stats/data-access';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authAdapter = inject(AuthAdapter);
  private readonly userConfigApi = inject(UserConfigApiService);
  private readonly platformId = inject(PLATFORM_ID);

  // Signal für den Status der User-DB-Synchronisation
  readonly userDbSyncState = signal<'idle' | 'syncing' | 'success' | 'error'>(
    'idle'
  );

  readonly user = computed(() =>
    mapAuthUserToPUSUser(this.authAdapter.authUser())
  );
  readonly isAuthenticated = this.authAdapter.isAuthenticated;
  readonly idToken = this.authAdapter.idToken;

  /** Sign in with Google */
  async signInWithGoogle(): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInWithGoogle();
      await this.syncUserDbSafe();
      return cred;
    }, 'Google sign-in');
  }

  /** Sign in with email and password */
  async signInWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInWithEmail(email, password);
      await this.syncUserDbSafe();
      return cred;
    }, 'Email sign-in');
  }

  /** Sign up with email and password */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signUpWithEmail(email, password);
      await this.syncUserDbSafe();
      return cred;
    }, 'Email sign-up');
  }

  /** Sign in anonymously (mainly for e2e testing) */
  async signInAnonymously(): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInAnonymously();
      // Anonymous users don't sync to userConfig DB
      return cred;
    }, 'Anonymous sign-in');
  }

  /** Sign out (alias for logout) */
  async signOut(): Promise<void> {
    await this.logout();
  }

  /** Permanently deletes current auth user */
  async deleteAccount(): Promise<void> {
    await this.wrapAsync(() => this.authAdapter.deleteUser(), 'Delete account');
  }

  /** Logout */
  async logout(): Promise<void> {
    await this.wrapAsync(() => this.authAdapter.signOut(), 'Sign-out');
  }

  /**
   * Synchronisiert den User-Eintrag in der DB nach Authentifizierung
   */
  private async syncUserDb(): Promise<void> {
    if (isPlatformServer(this.platformId)) return;
    const user = this.user();
    if (!user) return;
    this.userDbSyncState.set('syncing');
    try {
      // Nur erlaubte Felder an updateConfig übergeben
      await firstValueFrom(
        this.userConfigApi.updateConfig(user.uid, {
          email: user.email ?? undefined,
          displayName: user.displayName ?? undefined,
        })
      );
      this.userDbSyncState.set('success');
    } catch (e) {
      this.userDbSyncState.set('error');
      throw e;
    }
  }

  private async syncUserDbSafe(): Promise<void> {
    try {
      await this.syncUserDb();
    } catch (e) {
      // Do not fail login if user profile sync fails after successful auth.
      console.warn('[AuthService] user DB sync failed after auth:', e);
    }
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
