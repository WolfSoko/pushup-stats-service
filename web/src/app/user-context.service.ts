import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseAuthService } from './firebase/firebase-auth.service';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private static readonly USER_ID_STORAGE_KEY = 'pushups.userId';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly firebaseAuth = inject(FirebaseAuthService, { optional: true });
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly userId = signal('default');
  readonly userIdSafe = computed(() => (this.userId().trim() || 'default'));

  constructor() {
    if (!this.isBrowser) return;

    const stored = window.localStorage.getItem(UserContextService.USER_ID_STORAGE_KEY);
    if (stored && stored.trim()) {
      this.userId.set(stored.trim());
    }

    if (this.firebaseAuth?.enabled) {
      effect(() => {
        const user = this.firebaseAuth?.user();
        if (!user) return;
        this.setUserId(user.uid);
      });
    }
  }

  setUserId(next: string): void {
    const value = (next || '').trim() || 'default';
    this.userId.set(value);
    if (this.isBrowser) {
      window.localStorage.setItem(UserContextService.USER_ID_STORAGE_KEY, value);
    }
  }
}
