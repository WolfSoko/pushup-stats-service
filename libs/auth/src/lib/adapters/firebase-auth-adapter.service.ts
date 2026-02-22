import { Injectable } from '@angular/core';
import { User } from '../user/user.model';
import { AuthAdapter } from './auth.adapter';

@Injectable({
  providedIn: 'root',
})
export class FirebaseAuthAdapter implements AuthAdapter {
  private authInstance: import('firebase/auth').Auth | null = null;
  private unsubscribeFn: (() => void) | null = null;

  get isInitialized(): boolean {
    return this.authInstance !== null;
  }

  async initialize(config: Record<string, string>): Promise<void> {
    if (this.authInstance) {
      return;
    }

    const firebase = await import('firebase/app');
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');

    const existingApp = firebase
      .getApps()
      .find((app) => app.name === 'auth-app');
    const app =
      existingApp ||
      firebase.initializeApp(
        {
          apiKey: config['apiKey'],
          authDomain: config['authDomain'],
          projectId: config['projectId'],
          storageBucket: config['storageBucket'],
          messagingSenderId: config['messagingSenderId'],
          appId: config['appId'],
          measurementId: config['measurementId'],
        },
        'auth-app'
      );

    this.authInstance = getAuth(app);

    // Check for emulator
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
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    if (!this.authInstance) {
      throw new Error('Auth not initialized');
    }

    const { onAuthStateChanged } = require('firebase/auth');
    return onAuthStateChanged(this.authInstance, (fbUser) => {
      callback(this.mapFirebaseUser(fbUser));
    });
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

  async signInWithGoogle(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { GoogleAuthProvider, signInWithPopup } =
      await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    await signInWithPopup(this.authInstance, provider);
  }

  async signInWithMicrosoft(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new OAuthProvider('microsoft.com');
    await signInWithPopup(this.authInstance, provider);
  }

  async signInWithGitHub(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { GithubAuthProvider, signInWithPopup } =
      await import('firebase/auth');
    const provider = new GithubAuthProvider();
    provider.addScope('read:user');
    provider.addScope('user:email');
    await signInWithPopup(this.authInstance, provider);
  }

  async signInWithApple(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
    const provider = new OAuthProvider('apple.com');
    await signInWithPopup(this.authInstance, provider);
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(this.authInstance, email, password);
  }

  async signUpWithEmail(email: string, password: string): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    await createUserWithEmailAndPassword(this.authInstance, email, password);
  }

  async signOut(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const { signOut } = await import('firebase/auth');
    await signOut(this.authInstance);
  }

  async deleteUser(): Promise<void> {
    if (!this.authInstance) throw new Error('Auth not initialized');
    const currentUser = this.authInstance.currentUser;
    if (!currentUser) throw new Error('No user signed in');
    const { deleteUser: firebaseDeleteUser } = await import('firebase/auth');
    await firebaseDeleteUser(currentUser);
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!this.authInstance) return null;
    const currentUser = this.authInstance.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken(forceRefresh);
  }
}
