import { computed, inject, Injectable } from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authStore = inject(AuthStore);

  readonly isGuest = computed(
    () => this.authStore.user()?.isAnonymous ?? false
  );

  readonly userNameSafe = computed(() => {
    const user = this.authStore.user();
    return (
      user?.displayName || user?.email || $localize`:@@user.guestName:Gast`
    );
  });

  readonly userIdSafe = computed(() => this.authStore.user()?.uid ?? '');
}
