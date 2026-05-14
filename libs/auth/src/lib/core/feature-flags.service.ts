import { computed, inject, Injectable, Signal } from '@angular/core';
import { UserContextService } from './user-context.service';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private readonly user = inject(UserContextService);

  readonly autoExerciseCounter: Signal<boolean> = computed(() =>
    this.user.isAdmin()
  );
}
