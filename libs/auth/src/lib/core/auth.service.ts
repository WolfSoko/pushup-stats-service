import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { computed, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthAdapter } from '../adapters/auth.adapter';
import { mapAuthUserToPUSUser } from '../map-auth-user-to-user';
import {
  PushupFirestoreService,
  UserConfigApiService,
} from '@pu-stats/data-access';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authAdapter = inject(AuthAdapter);
  private readonly userConfigApi = inject(UserConfigApiService);
  private readonly pushupFirestore = inject(PushupFirestoreService, {
    optional: true,
  });
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

  /** Sign in as anonymous guest if no session exists yet.
   *
   * Awaits `authStateReady()` so Firebase has fully restored any persisted
   * session from IndexedDB before we decide whether a guest sign-in is
   * needed. Without this, the APP_INITIALIZER runs before Firebase has
   * restored a real (Google/email) session, `currentUser` is still `null`,
   * and an anonymous sign-in would silently overwrite the real session.
   */
  async signInGuestIfNeeded(): Promise<void> {
    if (isPlatformServer(this.platformId)) return;
    await this.authAdapter.authStateReady();
    if (this.authAdapter.currentUser) return;
    await this.signInAnonymously();
  }

  /** Sign in anonymously (mainly for e2e testing) */
  async signInAnonymously(): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInAnonymously();
      // Anonymous users don't sync to userConfig DB
      return cred;
    }, 'Anonymous sign-in');
  }

  /**
   * Upgrades an anonymous guest to a permanent email/password account.
   * If the user is currently anonymous, links the credential (keeps same UID).
   * Otherwise falls back to normal sign-up.
   */
  async upgradeWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(async () => {
      // Prefer auth.currentUser (synchronous, immediately available after
      // signInGuestIfNeeded()) over the signal-based authUser() which may
      // still hold stale data and cause the link path to be skipped.
      const currentUser =
        this.authAdapter.currentUser ?? this.authAdapter.authUser();
      if (currentUser?.isAnonymous) {
        const cred = await this.authAdapter.linkWithEmail(email, password);
        await this.syncUserDbSafe();
        return cred;
      }
      const cred = await this.authAdapter.signUpWithEmail(email, password);
      await this.syncUserDbSafe();
      return cred;
    }, 'Upgrade with email');
  }

  /**
   * Upgrades an anonymous guest to a permanent Google account.
   * If the user is currently anonymous, links the credential (keeps same UID).
   * Otherwise falls back to normal Google sign-in.
   */
  async upgradeWithGoogle(): Promise<void> {
    await this.wrapAsync(async () => {
      // Prefer auth.currentUser (synchronous, immediately available after
      // signInGuestIfNeeded()) over the signal-based authUser() which may
      // still hold stale data and cause the link path to be skipped.
      const currentUser =
        this.authAdapter.currentUser ?? this.authAdapter.authUser();
      if (currentUser?.isAnonymous) {
        const cred = await this.authAdapter.linkWithGoogle();
        await this.syncUserDbSafe();
        return cred;
      }
      const cred = await this.authAdapter.signInWithGoogle();
      await this.syncUserDbSafe();
      return cred;
    }, 'Upgrade with Google');
  }

  /**
   * Signs a guest into an EXISTING account (email/password).
   * Captures the guest UID first, signs in, then migrates orphaned pushup data.
   */
  async signInWithEmailAndMigrateGuest(
    email: string,
    password: string
  ): Promise<void> {
    await this.wrapAsync(async () => {
      const currentUser = this.authAdapter.currentUser;
      const guestUid = currentUser?.isAnonymous
        ? (currentUser.uid ?? null)
        : null;
      const cred = await this.authAdapter.signInWithEmail(email, password);
      await this.syncUserDbSafe();
      if (guestUid && cred.user.uid !== guestUid) {
        await this.migrateGuestDataSafe(guestUid, cred.user.uid);
      }
      return cred;
    }, 'Email sign-in with guest migration');
  }

  /**
   * Signs a guest into an EXISTING Google account.
   * Captures the guest UID first, signs in, then migrates orphaned pushup data.
   */
  async signInWithGoogleAndMigrateGuest(): Promise<void> {
    await this.wrapAsync(async () => {
      const currentUser = this.authAdapter.currentUser;
      const guestUid = currentUser?.isAnonymous
        ? (currentUser.uid ?? null)
        : null;
      const cred = await this.authAdapter.signInWithGoogle();
      await this.syncUserDbSafe();
      if (guestUid && cred.user.uid !== guestUid) {
        await this.migrateGuestDataSafe(guestUid, cred.user.uid);
      }
      return cred;
    }, 'Google sign-in with guest migration');
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
      const existingConfig = await firstValueFrom(
        this.userConfigApi.getConfig(user.uid)
      );

      // Wichtig: bereits gesetzten Anzeigenamen nicht mit Provider-DisplayName überschreiben.
      const nextDisplayName =
        existingConfig?.displayName?.trim() || user.displayName || undefined;

      await firstValueFrom(
        this.userConfigApi.updateConfig(user.uid, {
          email: user.email ?? undefined,
          displayName: nextDisplayName,
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

  private async migrateGuestDataSafe(
    fromUid: string,
    toUid: string
  ): Promise<void> {
    if (!this.pushupFirestore) return;
    try {
      await this.pushupFirestore.migrateUserData(fromUid, toUid);
    } catch (e) {
      // Migration failure must not block the sign-in itself.
      console.warn('[AuthService] guest data migration failed:', e);
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
