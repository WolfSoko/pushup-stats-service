import { effect, inject, Injectable } from '@angular/core';
import { AuthStore } from '@pu-auth/auth';
import { ReminderService, ReminderStore } from '@pu-reminders/reminders';

/**
 * Orchestrates reminder lifecycle based on auth state.
 * Loads reminder config on login, starts/stops the service accordingly.
 * Inject once (e.g. in App root) to activate.
 */
@Injectable({ providedIn: 'root' })
export class ReminderOrchestrationService {
  private readonly auth = inject(AuthStore);
  private readonly reminderStore = inject(ReminderStore);
  private readonly reminderService = inject(ReminderService);

  private readonly _effect = effect(() => {
    const user = this.auth.user();
    if (user && !user.isAnonymous) {
      const uid = user.uid;
      this.reminderStore.loadConfig(uid).then(() => {
        if (this.auth.user()?.uid === uid) {
          this.reminderService.start();
        }
      });
    } else {
      this.reminderService.stop();
    }
  });

  stop(): void {
    this.reminderService.stop();
  }
}
