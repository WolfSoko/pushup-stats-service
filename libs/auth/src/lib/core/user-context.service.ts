import { computed, inject, Injectable, resource } from '@angular/core';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { AuthStore } from './state/auth.store';

@Injectable({ providedIn: 'root' })
export class UserContextService {
  private readonly authStore = inject(AuthStore);
  private readonly firestore = inject(Firestore, { optional: true });

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

  private readonly userConfigResource = resource({
    params: () => ({ userId: this.userIdSafe() }),
    loader: async ({ params }) => {
      if (!params.userId || !this.firestore) return null;
      const snap = await getDoc(
        doc(this.firestore, 'userConfigs', params.userId)
      );
      return snap.exists() ? (snap.data() as { role?: string }) : null;
    },
  });

  readonly isAdmin = computed(
    () => this.userConfigResource.value()?.role === 'admin'
  );
}
