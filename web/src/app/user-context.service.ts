import { computed, inject, Injectable } from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authStore = inject(AuthStore);
  readonly userNameSafe = computed(() => {
    return this.authStore.user()?.displayName ?? 'default';
  });

  userIdSafe() {
    return this.authStore.user()?.uid ?? 'default';
  }
}
