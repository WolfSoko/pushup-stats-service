import {
  Injectable,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthService } from '@pu-auth/auth';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private static readonly USER_ID_STORAGE_KEY = 'pushups.userId';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly firebaseAuth = inject(AuthService, {
    optional: true,
  });
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly userId = signal('default');
  readonly userName = signal('default');
  readonly userIdSafe = computed(() => this.userId().trim() || 'default');
  readonly userNameSafe = computed(() => this.userName().trim() || 'default');

  constructor() {
    if (!this.isBrowser) return;

    const stored = window.localStorage.getItem(
      UserContextService.USER_ID_STORAGE_KEY
    );
    if (stored && stored.trim()) {
      this.userId.set(stored.trim());
    }

    effect(() => {
      const user = this.firebaseAuth?.user();
      if (!user) {
        this.setUserId('default');
        this.userName.set('default');
        return;
      }
      this.setUserId(user.uid);
      this.userName.set(user.displayName ?? user.email ?? '');
    });
  }

  setUserId(next: string): void {
    const value = (next || '').trim() || 'default';
    this.userId.set(value);
    if (this.isBrowser) {
      window.localStorage.setItem(
        UserContextService.USER_ID_STORAGE_KEY,
        value
      );
    }
  }
}
