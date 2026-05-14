import { Injectable, signal, Signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  /**
   * Auto-exercise counter is live for everyone. The flag survives as a
   * kill-switch surface — flipping the constant back to a computed
   * (e.g. admin claim, Remote Config) re-gates the feature without
   * touching every call site. The dialog, FAB item, and landing-page
   * card all read this signal.
   */
  readonly autoExerciseCounter: Signal<boolean> = signal(true).asReadonly();
}
