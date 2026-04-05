import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  idToken,
  linkWithCredential,
  linkWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  user,
  UserCredential,
} from '@angular/fire/auth';

export type AuthProvider = 'google' | 'email';

export interface AuthCredentials {
  email: string;
  password: string;
}
@Injectable({
  providedIn: 'root',
})
export class AuthAdapter {
  private auth = inject(Auth);

  /**
   * Synchronous Firebase current user — available immediately after Firebase
   * initializes, before the signal-based authState() has settled.
   * Use this for startup-race-safe checks (mirrors the pattern in authGuard).
   */
  get currentUser() {
    return this.auth.currentUser;
  }

  /**
   * Resolves once Firebase has determined the initial auth state
   * (persisted session restored or confirmed absent).
   * Must be awaited before making guest-sign-in decisions to avoid
   * overwriting a real session during the startup race window.
   */
  authStateReady(): Promise<void> {
    return this.auth.authStateReady();
  }

  // Public computed signals
  readonly authUser = toSignal(user(this.auth));
  readonly authState = toSignal(authState(this.auth));
  readonly loading = signal(false);
  readonly error = signal<null | Error>(null);
  readonly isAuthenticated = computed(() => this.authState() != null);
  /** `true` once the initial Firebase auth state has been determined (session restored or confirmed absent). */
  readonly authResolved = computed(() => this.authState() !== undefined);
  readonly idToken = toSignal(idToken(this.auth));

  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.addScope('');
    return await signInWithPopup(this.auth, provider);
  }

  async signInWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  async signInAnonymously(): Promise<UserCredential> {
    return await signInAnonymously(this.auth);
  }

  /**
   * Links the current anonymous user to an email/password credential.
   * Keeps the same UID → no data migration needed.
   */
  async linkWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    const current = this.auth.currentUser;
    if (!current) throw new Error('No current user to link');
    const credential = EmailAuthProvider.credential(email, password);
    return await linkWithCredential(current, credential);
  }

  /**
   * Links the current anonymous user to a Google credential.
   * Keeps the same UID → no data migration needed.
   */
  async linkWithGoogle(): Promise<UserCredential> {
    const current = this.auth.currentUser;
    if (!current) throw new Error('No current user to link');
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await linkWithPopup(current, provider);
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  async deleteUser(): Promise<void> {
    if (this.auth.currentUser) {
      return await deleteUser(this.auth.currentUser);
    }
  }
}
