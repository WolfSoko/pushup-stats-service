import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { Functions, httpsCallable } from '@angular/fire/functions';

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
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  // Functions is browser-only (SSR has no AngularFire Functions instance and
  // we never invoke callables on the server). Inject as optional so SSR
  // bootstrap doesn't blow up when no Functions provider is registered.
  private functions = this.isBrowser
    ? inject(Functions, { optional: true })
    : null;

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

  // On SSR, Firebase Auth observables crash because the server app's
  // _initializePromise is null. Return null (= resolved, unauthenticated)
  // so that authResolved() is true and SSR renders the unauthenticated state.
  readonly authUser = this.isBrowser ? toSignal(user(this.auth)) : signal(null);
  readonly authState = this.isBrowser
    ? toSignal(authState(this.auth))
    : signal(null);
  readonly loading = signal(false);
  readonly error = signal<null | Error>(null);
  readonly isAuthenticated = computed(() => this.authState() != null);
  /** `true` once the initial Firebase auth state has been determined (session restored or confirmed absent). */
  readonly authResolved = computed(() => this.authState() !== undefined);
  readonly idToken = this.isBrowser
    ? toSignal(idToken(this.auth))
    : signal(null);

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

  /**
   * Calls the `unsubscribeAllPushDevices` Cloud Function which removes every
   * push subscription stored against the current user's UID across all
   * devices. Does NOT sign the user out — the session and auth tokens stay
   * valid.
   */
  async unsubscribeAllPushDevices(): Promise<void> {
    if (!this.functions) {
      throw new Error('Cloud Functions not available');
    }
    const callable = httpsCallable<unknown, { ok: boolean }>(
      this.functions,
      'unsubscribeAllPushDevices'
    );
    await callable({});
  }
}
