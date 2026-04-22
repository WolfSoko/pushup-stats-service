import { signal } from '@angular/core';
import { computed, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthAdapter } from '../adapters/auth.adapter';
import { mapAuthUserToPUSUser } from '../map-auth-user-to-user';
import { POST_AUTH_HOOKS } from './ports/post-auth.hook';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authAdapter = inject(AuthAdapter);
  private readonly postAuthHooks =
    inject(POST_AUTH_HOOKS, { optional: true }) ?? [];
  private readonly platformId = inject(PLATFORM_ID);

  // Signal für den Status der User-DB-Synchronisation
  readonly userDbSyncState = signal<'idle' | 'syncing' | 'success' | 'error'>(
    'idle'
  );

  readonly user = computed(() =>
    mapAuthUserToPUSUser(this.authAdapter.authUser())
  );
  readonly isAuthenticated = this.authAdapter.isAuthenticated;
  readonly authResolved = this.authAdapter.authResolved;
  readonly idToken = this.authAdapter.idToken;

  /** Sign in with Google */
  async signInWithGoogle(): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInWithGoogle();
      await this.runPostAuthHooks();
      return cred;
    }, 'Google sign-in');
  }

  /** Sign in with email and password */
  async signInWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signInWithEmail(email, password);
      await this.runPostAuthHooks();
      return cred;
    }, 'Email sign-in');
  }

  /** Sign up with email and password */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    await this.wrapAsync(async () => {
      const cred = await this.authAdapter.signUpWithEmail(email, password);
      await this.runPostAuthHooks();
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
        await this.runPostAuthHooks();
        return cred;
      }
      const cred = await this.authAdapter.signUpWithEmail(email, password);
      await this.runPostAuthHooks();
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
        await this.runPostAuthHooks();
        return cred;
      }
      const cred = await this.authAdapter.signInWithGoogle();
      await this.runPostAuthHooks();
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
      await this.runPostAuthHooks();
      if (guestUid && cred.user.uid !== guestUid) {
        await this.runGuestMigrationHooks(guestUid, cred.user.uid);
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
      await this.runPostAuthHooks();
      if (guestUid && cred.user.uid !== guestUid) {
        await this.runGuestMigrationHooks(guestUid, cred.user.uid);
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
   * Removes every push subscription stored server-side for the current user
   * across all devices. Does NOT sign the user out — the current session
   * (and every other signed-in device) stays active; only Web Push
   * notifications stop being delivered.
   */
  async unsubscribeAllPushDevices(): Promise<void> {
    await this.wrapAsync(
      () => this.authAdapter.unsubscribeAllPushDevices(),
      'Unsubscribe all push devices'
    );
  }

  /**
   * Runs all registered post-auth hooks after successful authentication.
   */
  private async runPostAuthHooks(): Promise<void> {
    if (isPlatformServer(this.platformId)) return;
    // Prefer synchronous auth.currentUser over the signal-based user() which
    // is backed by toSignal() and may still hold stale data (e.g. the old
    // anonymous user) due to the microtask delay between the auth operation
    // completing and the observable emission settling into the signal.
    const firebaseUser = this.authAdapter.currentUser;
    const user = firebaseUser
      ? mapAuthUserToPUSUser(firebaseUser)
      : this.user();
    if (!user) return;
    this.userDbSyncState.set('syncing');
    try {
      await Promise.all(
        this.postAuthHooks.map((hook) => hook.onAuthenticated(user))
      );
      this.userDbSyncState.set('success');
    } catch (e) {
      this.userDbSyncState.set('error');
      // Do not fail login if post-auth hooks fail after successful auth.
      console.warn('[AuthService] post-auth hook failed:', e);
    }
  }

  private async runGuestMigrationHooks(
    fromUid: string,
    toUid: string
  ): Promise<void> {
    try {
      await Promise.all(
        this.postAuthHooks
          .filter((hook) => hook.onGuestMigration)
          .map((hook) => hook.onGuestMigration!(fromUid, toUid))
      );
    } catch (e) {
      // Migration failure must not block the sign-in itself.
      console.warn('[AuthService] guest data migration hook failed:', e);
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
