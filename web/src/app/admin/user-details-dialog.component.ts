import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AdminUser } from './admin-page.component';

@Component({
  selector: 'app-user-details-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title i18n="@@admin.details.title">Benutzerdetails</h2>
    <mat-dialog-content class="details-content">
      <dl class="details-list">
        <dt i18n="@@admin.details.uid">UID</dt>
        <dd class="mono">{{ user.uid }}</dd>

        <dt i18n="@@admin.details.displayName">Name</dt>
        <dd>{{ user.displayName ?? emptyLabel }}</dd>

        <dt i18n="@@admin.details.email">E-Mail</dt>
        <dd>{{ user.email ?? emptyLabel }}</dd>

        <dt i18n="@@admin.details.anonymous">Anonym</dt>
        <dd>
          @if (user.anonymous) {
            <mat-icon class="anon-icon">person_outline</mat-icon>
            <span i18n="@@admin.details.anonymous.yes">Ja</span>
          } @else {
            <span i18n="@@admin.details.anonymous.no">Nein</span>
          }
        </dd>

        <dt i18n="@@admin.details.role">Rolle</dt>
        <dd>{{ user.role ?? emptyLabel }}</dd>

        <dt i18n="@@admin.details.pushupCount">Pushups</dt>
        <dd>{{ user.pushupCount }}</dd>

        <dt i18n="@@admin.details.lastEntry">Letzter Eintrag</dt>
        <dd>
          {{ (user.lastEntry | date: 'medium') ?? emptyLabel }}
        </dd>

        <dt i18n="@@admin.details.createdAt">Erstellt</dt>
        <dd>
          {{ (user.createdAt | date: 'medium') ?? emptyLabel }}
        </dd>
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@admin.details.close">
        Schließen
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .details-content {
      min-width: min(92vw, 420px);
    }
    .details-list {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 16px;
      margin: 0;
    }
    .details-list dt {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85em;
      align-self: center;
    }
    .details-list dd {
      margin: 0;
      word-break: break-word;
    }
    .mono {
      font-family: monospace;
      font-size: 0.9em;
    }
    .anon-icon {
      vertical-align: middle;
      margin-right: 4px;
      color: var(--mat-sys-error);
    }
  `,
})
export class UserDetailsDialogComponent {
  readonly user = inject<AdminUser>(MAT_DIALOG_DATA);
  readonly emptyLabel = '–';
}
