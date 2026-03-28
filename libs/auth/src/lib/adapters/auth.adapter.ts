import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  idToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  user,
  UserCredential,
} from '@angular/fire/auth';
import { EMPTY } from 'rxjs';

export type AuthProvider = 'google' | 'email';

export interface AuthCredentials {
  email: string;
  password: string;
}
@Injectable({
  providedIn: 'root',
})
export class AuthAdapter {
  private auth = inject(Auth, { optional: true });
  // Public computed signals
  readonly authUser = toSignal(this.auth ? user(this.auth) : EMPTY, {
    initialValue: null,
  });
  readonly authState = toSignal(this.auth ? authState(this.auth) : EMPTY, {
    initialValue: null,
  });
  readonly loading = signal(false);
  readonly error = signal<null | Error>(null);
  readonly isAuthenticated = computed(() => this.authState() != null);
  readonly idToken = toSignal(this.auth ? idToken(this.auth) : EMPTY, {
    initialValue: null,
  });

  async signInWithGoogle(): Promise<UserCredential> {
    if (!this.auth) throw new Error('Auth not available');
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
    if (!this.auth) throw new Error('Auth not available');
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<UserCredential> {
    if (!this.auth) throw new Error('Auth not available');
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  signOut(): Promise<void> {
    if (!this.auth) return Promise.resolve();
    return signOut(this.auth);
  }

  async deleteUser(): Promise<void> {
    if (this.auth?.currentUser) {
      return await deleteUser(this.auth.currentUser);
    }
  }
}
