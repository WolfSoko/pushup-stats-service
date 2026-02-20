import { Injectable, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import {
  type Auth,
  EmailAuthProvider,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  getAuth,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  isFirebaseConfigured,
  resolveFirebaseConfig,
  type FirebaseConfig,
} from './firebase-config';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = resolveFirebaseConfig();

  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;

  readonly user = signal<import('firebase/auth').User | null>(null);

  readonly providers = {
    google: new GoogleAuthProvider(),
    github: new GithubAuthProvider(),
    microsoft: new OAuthProvider('microsoft.com'),
    apple: new OAuthProvider('apple.com'),
    email: new EmailAuthProvider(),
  };

  get enabled(): boolean {
    return isFirebaseConfigured(this.config);
  }

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.enabled) return;

    this.app = initializeApp(this.config);
    this.auth = getAuth(this.app);

    onAuthStateChanged(this.auth, (user) => this.user.set(user));
  }

  getAuth(): Auth | null {
    return this.auth;
  }

  async signInWithProvider(
    providerKey: keyof FirebaseAuthService['providers']
  ): Promise<void> {
    if (!this.auth) return;
    const provider = this.providers[providerKey];
    await signInWithPopup(this.auth, provider);
  }

  async signOut(): Promise<void> {
    if (!this.auth) return;
    await signOut(this.auth);
  }

  getConfig(): FirebaseConfig {
    return this.config;
  }
}
