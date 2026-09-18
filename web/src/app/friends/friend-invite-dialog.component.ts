import {
  ChangeDetectionStrategy,
  Component,
  inject,
  resource,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { InviteService } from '../core/invite.service';
import { ShareService } from '../core/share.service';

/**
 * "Add a friend": your own invite link, to hand to someone.
 *
 * There is no search — following the link is what starts the friendship,
 * and `claimFriendInvite` turns it into a request from you, so the other
 * side only has to accept. The link is shown rather than only shared
 * because the share sheet is a phone feature; on a desktop there is
 * frequently nothing behind it but the clipboard.
 *
 * The link is only useful once its token has been minted, so the dialog
 * waits for one rather than offering a half-link that would attribute a
 * signup but add nobody. A guest gets no token — their account does not
 * outlive the session — and is told to sign up instead.
 */
@Component({
  selector: 'app-friend-invite-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@friends.invite.title">Freund hinzufügen</h2>
    <mat-dialog-content class="content">
      @if (token.isLoading()) {
        <div class="centered"><mat-spinner diameter="32" /></div>
      } @else if (ready()) {
        <p class="hint" i18n="@@friends.invite.hint">
          Schick diesen Link an jemanden, mit dem du trainieren möchtest. Wer
          ihn öffnet, bekommt eine Anfrage von dir und muss sie nur noch
          annehmen.
        </p>
        <mat-form-field appearance="outline" class="field">
          <mat-label i18n="@@friends.invite.link"
            >Dein Einladungslink</mat-label
          >
          <input
            matInput
            readonly
            data-testid="invite-link"
            [value]="url()"
            (focus)="selectAll($event)"
          />
        </mat-form-field>
      } @else {
        <p
          class="hint"
          data-testid="invite-unavailable"
          i18n="@@friends.invite.unavailable"
        >
          Einladungslinks gibt es nur für angemeldete Konten. Melde dich an,
          dann kannst du Freunde hinzufügen.
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        mat-dialog-close
        i18n="@@friends.invite.close"
      >
        Schließen
      </button>
      @if (ready()) {
        <button
          mat-stroked-button
          type="button"
          data-testid="invite-copy"
          (click)="copy()"
        >
          <mat-icon>content_copy</mat-icon>
          <span i18n="@@friends.invite.copy">Kopieren</span>
        </button>
        <button
          mat-flat-button
          type="button"
          data-testid="invite-share"
          (click)="share()"
        >
          <mat-icon>share</mat-icon>
          <span i18n="@@friends.invite.share">Teilen</span>
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: grid;
      gap: 8px;
      min-width: min(80vw, 380px);
    }
    .centered {
      display: flex;
      justify-content: center;
      padding: 12px 0;
    }
    .hint {
      margin: 0 0 4px;
      opacity: 0.8;
    }
    .field {
      width: 100%;
    }
    mat-dialog-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class FriendInviteDialogComponent {
  private readonly invites = inject(InviteService);
  private readonly sharing = inject(ShareService);

  protected readonly token = resource({
    loader: () => this.invites.ensureToken(),
  });

  protected readonly ready = this.invites.canAddFriend;
  protected readonly url = this.invites.inviteUrl;

  protected copy(): void {
    void this.sharing.copyLink(this.url());
  }

  protected share(): void {
    void this.invites.inviteFriend();
  }

  /** Tapping the field should hand over the whole link, not a caret. */
  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
