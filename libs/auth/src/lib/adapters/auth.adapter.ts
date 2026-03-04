import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  idToken,
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
  // Public computed signals
  readonly authUser = toSignal(user(this.auth));
  readonly authState = toSignal(authState(this.auth));
  readonly loading = signal(false);
  readonly error = signal<null | Error>(null);
  readonly isAuthenticated = computed(() => this.authState() != null);
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

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  async deleteUser(): Promise<void> {
    if (this.auth.currentUser) {
      return await deleteUser(this.auth.currentUser);
    }
  }
}
