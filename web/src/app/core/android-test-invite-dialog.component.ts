import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CallableFunctionsService } from '../admin/callable-functions.service';
import { UserConfigStore } from './user-config.store';

const POPUP_SNOOZE_DAYS = 14;

type InviteDialogState = 'ask' | 'thanks';

/**
 * Invite popup for the Android closed-test tester program. Only ever opened
 * for users whose `androidTest.status` is already `'confirmed'` by an admin
 * — see `AndroidTestInviteOrchestrationService`.
 */
@Component({
  selector: 'app-android-test-invite-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 10px;
      max-width: 380px;
    }
    .error {
      color: var(--mat-sys-error, #b00020);
    }
  `,
  template: `
    @if (state() === 'ask') {
      <h2 mat-dialog-title i18n="@@androidTest.invite.title">
        Werde Android-App-Tester
      </h2>
      <mat-dialog-content>
        <p i18n="@@androidTest.invite.body">
          Wir bauen gerade die PushUp Stats Android-App und suchen Tester. Hast
          du Lust, sie vor allen anderen auszuprobieren?
        </p>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button
          type="button"
          mat-button
          [disabled]="loading()"
          (click)="dismiss()"
          i18n="@@androidTest.invite.notNow"
        >
          Nicht jetzt
        </button>
        <button
          type="button"
          mat-flat-button
          [disabled]="loading()"
          (click)="optIn()"
          i18n="@@androidTest.invite.join"
        >
          @if (loading()) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            Ich bin dabei
          }
        </button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title i18n="@@androidTest.invite.thanksTitle">Danke!</h2>
      <mat-dialog-content>
        <p i18n="@@androidTest.invite.thanksBody">
          Du wirst per Push-Benachrichtigung informiert, sobald du als Tester
          freigeschaltet bist.
        </p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button
          type="button"
          mat-flat-button
          mat-dialog-close
          i18n="@@androidTest.invite.close"
        >
          Schließen
        </button>
      </mat-dialog-actions>
    }
  `,
})
export class AndroidTestInviteDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<AndroidTestInviteDialogComponent>
  );
  private readonly callables = inject(CallableFunctionsService);
  private readonly userConfig = inject(UserConfigStore);

  readonly state = signal<InviteDialogState>('ask');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async optIn(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const callable = this.callables.call('optInAndroidTest');
      await callable();
      this.state.set('thanks');
    } catch {
      this.error.set(
        $localize`:@@androidTest.invite.error:Das hat leider nicht geklappt. Bitte versuch es später erneut.`
      );
    } finally {
      this.loading.set(false);
    }
  }

  async dismiss(): Promise<void> {
    const until = new Date(
      Date.now() + POPUP_SNOOZE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    try {
      // Read-modify-write of the whole `ui` map — see
      // docs/gotchas/firestore.md on partial `ui` patches.
      const currentUi = this.userConfig.config()?.ui ?? {};
      await this.userConfig.save({
        ui: { ...currentUi, androidTestPopupDismissedUntil: until },
      });
    } catch {
      // Persisting the snooze is best-effort: failing to save it must not
      // trap the user in a dialog they explicitly dismissed. The popup is
      // session-guarded anyway, so the worst case is it reappears next load.
    } finally {
      this.dialogRef.close();
    }
  }
}
