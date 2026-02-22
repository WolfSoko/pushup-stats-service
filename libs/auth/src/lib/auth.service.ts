import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  OnDestroy,
} from '@angular/core';
import {
  FIREBASE_AUTH_CONFIG,
  isFirebaseAuthConfigured,
} from './firebase-auth.config';
import { User } from './user/user.model';

// Lazy load Firebase Auth only on browser
let FirebaseModule: typeof import('firebase/auth') | null = null;

async function getFirebaseAuth() {
  if (!FirebaseModule) {
    FirebaseModule = await import('firebase/auth');
  }
  return FirebaseModule;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = inject(FIREBASE_AUTH_CONFIG);

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private authInstance: import('firebase/auth').Auth | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  // Signals for reactive state
  private readonly _user = signal<User | null>(null);
  private readonly _loading = signal<boolean>(true);
  private readonly _error = signal<Error | null>(null);

  // Public computed signals
  readonly user = computed(() => this._user());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly isAuthenticated = computed(() => !!this._user());

  constructor() {
    if (this.isBrowser && isFirebaseAuthConfigured(this.config)) {
      void this.initializeAuth();
    } else {
      this._loading.set(false);
      if (!this.isBrowser) {
        console.log('[AuthService] Skipping init - server-side rendering');
      }
      if (!isFirebaseAuthConfigured(this.config)) {
        console.warn('[AuthService] Firebase config incomplete');
      }
    }
  }

  private async initializeAuth(): Promise<void> {
    try {
      const firebase = await import('firebase/app');
      const { getAuth, onAuthStateChanged, connectAuthEmulator } =
        await getFirebaseAuth();

      // Check if app already initialized
      const existingApp = firebase
        .getApps()
        .find((app) => app.name === 'auth-app');
      const app =
        existingApp ||
        firebase.initializeApp(
          {
            apiKey: this.config.apiKey,
            authDomain: this.config.authDomain,
            projectId: this.config.projectId,
            storageBucket: this.config.storageBucket,
            messagingSenderId: this.config.messagingSenderId,
            appId: this.config.appId,
            measurementId: this.config.measurementId,
          },
          'auth-app'
        );

      this.authInstance = getAuth(app);

      // Check for emulator in dev mode
      if (
        typeof window !== 'undefined' &&
        (window as { __FIREBASE_AUTH_EMULATOR_HOST__?: string })
          .__FIREBASE_AUTH_EMULATOR_HOST__
      ) {
        const emulatorHost = (
          window as { __FIREBASE_AUTH_EMULATOR_HOST__?: string }
        ).__FIREBASE_AUTH_EMULATOR_HOST__;
        if (emulatorHost && !this.authInstance.emulatorConfig) {
          connectAuthEmulator(this.authInstance, emulatorHost, {
            disableWarnings: true,
          });
        }
      }

      this.unsubscribeAuth = onAuthStateChanged(
        this.authInstance,
        (firebaseUser) => {
          this._user.set(this.mapFirebaseUser(firebaseUser));
          this._loading.set(false);
        },
        (err) => {
          this._error.set(err);
          this._loading.set(false);
          console.error('[AuthService] Auth state error:', err);
        }
      );
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      this._loading.set(false);
      console.error('[AuthService] Failed to initialize auth:', err);
    }
  }

  private mapFirebaseUser(
    fbUser: import('firebase/auth').User | null
  ): User | null {
    if (!fbUser) return null;

    return {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      emailVerified: fbUser.emailVerified,
      providerId: fbUser.providerData[0]?.providerId || 'unknown',
      isAnonymous: fbUser.isAnonymous,
    };
  }

  /** Sign in with Google */
  async signInWithGoogle(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { GoogleAuthProvider, signInWithPopup } = await getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      await signInWithPopup(this.authInstance, provider);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Google sign-in error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign in with Email/Password */
  async signInWithMicrosoft(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { OAuthProvider, signInWithPopup } = await getFirebaseAuth();
      const provider = new OAuthProvider('microsoft.com');
      await signInWithPopup(this.authInstance, provider);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Microsoft sign-in error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign in with GitHub */
  async signInWithGitHub(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { GithubAuthProvider, signInWithPopup } = await getFirebaseAuth();
      const provider = new GithubAuthProvider();
      provider.addScope('read:user');
      provider.addScope('user:email');
      await signInWithPopup(this.authInstance, provider);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] GitHub sign-in error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign in with Apple */
  async signInWithApple(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { OAuthProvider, signInWithPopup } = await getFirebaseAuth();
      const provider = new OAuthProvider('apple.com');
      await signInWithPopup(this.authInstance, provider);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Apple sign-in error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign in with Email/Password */
  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { signInWithEmailAndPassword } = await getFirebaseAuth();
      await signInWithEmailAndPassword(this.authInstance, email, password);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Email sign-in error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign up with Email/Password */
  async signUpWithEmail(email: string, password: string): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { createUserWithEmailAndPassword } = await getFirebaseAuth();
      await createUserWithEmailAndPassword(this.authInstance, email, password);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Email sign-up error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Sign out */
  async signOut(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { signOut } = await getFirebaseAuth();
      await signOut(this.authInstance);
      this._user.set(null);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Sign-out error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Delete user account */
  async deleteUser(): Promise<void> {
    if (!this.isBrowser || !this.authInstance) {
      throw new Error('Auth not initialized');
    }

    const currentUser = this.authInstance.currentUser;
    if (!currentUser) {
      throw new Error('No user is currently signed in');
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { deleteUser: firebaseDeleteUser } = await getFirebaseAuth();
      await firebaseDeleteUser(currentUser);
      this._user.set(null);
    } catch (err) {
      this._error.set(err instanceof Error ? err : new Error(String(err)));
      console.error('[AuthService] Delete user error:', err);
      throw err;
    } finally {
      this._loading.set(false);
    }
  }

  /** Get current user ID token */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!this.isBrowser || !this.authInstance) {
      return null;
    }

    const currentUser = this.authInstance.currentUser;
    if (!currentUser) {
      return null;
    }

    try {
      return await currentUser.getIdToken(forceRefresh);
    } catch (err) {
      console.error('[AuthService] Get ID token error:', err);
      return null;
    }
  }

  ngOnDestroy(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }
}
