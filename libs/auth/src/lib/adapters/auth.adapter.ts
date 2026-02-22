import { InjectionToken } from '@angular/core';
import { User } from '../user/user.model';

export type AuthProvider =
  | 'google'
  | 'microsoft'
  | 'github'
  | 'apple'
  | 'email';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthAdapter {
  /** Initialize the auth instance */
  initialize(config: Record<string, string>): Promise<void>;

  /** Subscribe to auth state changes */
  onAuthStateChanged(callback: (user: User | null) => void): () => void;

  /** Sign in with Google */
  signInWithGoogle(): Promise<void>;

  /** Sign in with Microsoft */
  signInWithMicrosoft(): Promise<void>;

  /** Sign in with GitHub */
  signInWithGitHub(): Promise<void>;

  /** Sign in with Apple */
  signInWithApple(): Promise<void>;

  /** Sign in with email/password */
  signInWithEmail(email: string, password: string): Promise<void>;

  /** Sign up with email/password */
  signUpWithEmail(email: string, password: string): Promise<void>;

  /** Sign out */
  signOut(): Promise<void>;

  /** Delete current user */
  deleteUser(): Promise<void>;

  /** Get ID token */
  getIdToken(forceRefresh?: boolean): Promise<string | null>;

  /** Check if initialized */
  readonly isInitialized: boolean;
}

export const FIREBASE_AUTH_ADAPTER = new InjectionToken<AuthAdapter>(
  'FIREBASE_AUTH_ADAPTER'
);
