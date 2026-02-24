import { computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  deleteUser,
  GoogleAuthProvider,
  idToken,
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

export class AuthAdapter {
  private auth = inject(Auth);
  // Public computed signals
  readonly authUser = toSignal(user(this.auth));
  readonly authState = toSignal(authState(this.auth));
  readonly loading = signal(false);
  readonly error = signal<null | Error>(null);
  readonly isAuthenticated = computed(() => this.authState() != null);
  readonly idToken = toSignal(idToken(this.auth));

  /** Sign in with Google */
  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(this.auth, provider);
  }

  /** Sign in with email and password */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  /** Sign up with email and password */
  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  /** Sign out */
  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  /** Delete current user */
  async deleteUser(): Promise<void> {
    if (this.auth.currentUser) {
      return await deleteUser(this.auth.currentUser);
    }
  }
}
