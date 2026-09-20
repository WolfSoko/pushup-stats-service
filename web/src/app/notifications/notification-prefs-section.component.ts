import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NotificationType } from '@pu-stats/models';

import { UserConfigStore } from '../core/user-config.store';

interface PrefToggle {
  readonly type: NotificationType;
  readonly label: string;
}

/**
 * Per-type push opt-out for friend notifications.
 *
 * Switching one off silences the push, not the message: the entry still
 * lands in the inbox. That is the whole reason these switches can exist
 * — before the inbox, a suppressed cheer was a cheer nobody ever heard
 * about.
 */
@Component({
  selector: 'app-notification-prefs-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule],
  template: `
    <section>
      <p class="field-label" i18n="@@notificationPrefs.label">
        Push von Freunden
      </p>
      <p class="muted" i18n="@@notificationPrefs.desc">
        Was davon dein Handy klingeln lassen darf. Ausgeschaltet heißt nur: kein
        Push — in deinen Nachrichten steht es trotzdem. Deine Ruhezeiten oben
        gelten auch hier.
      </p>

      @for (toggle of toggles; track toggle.type) {
        <mat-slide-toggle
          [checked]="isEnabled(toggle.type)"
          (change)="setEnabled(toggle.type, $event.checked)"
        >
          {{ toggle.label }}
        </mat-slide-toggle>
      }
    </section>
  `,
  styles: `
    section {
      display: grid;
      gap: 8px;
      margin-block: 8px;
    }
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0 0 4px;
    }
  `,
})
export class NotificationPrefsSectionComponent {
  private readonly config = inject(UserConfigStore);

  protected readonly toggles: ReadonlyArray<PrefToggle> = [
    {
      type: 'cheer',
      label: $localize`:@@notificationPrefs.cheer:Anfeuerungen`,
    },
    {
      type: 'friendRequest',
      label: $localize`:@@notificationPrefs.friendRequest:Freundschaftsanfragen`,
    },
    {
      type: 'friendAccepted',
      label: $localize`:@@notificationPrefs.friendAccepted:Angenommene Anfragen`,
    },
    {
      type: 'challenge',
      label: $localize`:@@notificationPrefs.challenge:Challenge-Einladungen`,
    },
    {
      type: 'challengeAccepted',
      label: $localize`:@@notificationPrefs.challengeAccepted:Zusagen zu deinen Challenges`,
    },
    {
      type: 'workoutShared',
      label: $localize`:@@notificationPrefs.workoutShared:Geteilte Sessions`,
    },
  ];

  /** Absent means on — the switches are opt-out, not opt-in. */
  protected isEnabled(type: NotificationType): boolean {
    return this.config.config()?.notificationPrefs?.[type] !== false;
  }

  protected setEnabled(type: NotificationType, enabled: boolean): void {
    const current = this.config.config()?.notificationPrefs ?? {};
    void this.config
      .save({ notificationPrefs: { ...current, [type]: enabled } })
      .catch(() => undefined);
  }
}
