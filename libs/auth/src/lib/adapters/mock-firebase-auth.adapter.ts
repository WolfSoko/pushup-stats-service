import { Injectable, signal } from '@angular/core';
import { User } from '../user/user.model';
import { AuthAdapter } from './auth.adapter';

@Injectable()
export class MockFirebaseAuthAdapter implements Partial<AuthAdapter> {
  private _isInitialized = false;
  private currentUser = signal<User | null>(null);
  private callbacks: ((user: User | null) => void)[] = [];

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(_config: Record<string, string>): Promise<void> {
    this._isInitialized = true;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    this.callbacks.push(callback);
    // Emit current state immediately
    callback(this.currentUser());

    return () => {
      // empty unregister function
    };
  }
}
