import { computed, inject, Injectable, resource } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { AuthStore } from './state/auth.store';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authStore = inject(AuthStore);
  private readonly firebaseAuth = inject(Auth, { optional: true });

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

  private readonly adminClaimResource = resource({
    params: () => ({ userId: this.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId || !this.firebaseAuth) return false;
      const user = this.firebaseAuth.currentUser;
      if (!user) return false;
      const tokenResult = await user.getIdTokenResult();
      return tokenResult.claims['admin'] === true;
    },
  });

  readonly isAdmin = computed(() => this.adminClaimResource.value() === true);
}
