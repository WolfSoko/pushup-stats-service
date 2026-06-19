import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-unsubscribe-all-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <section class="reminder-section">
      <h3 i18n="@@unsubAll.section.title">📵 Push auf allen Geräten</h3>
      <p class="muted" i18n="@@unsubAll.section.desc">
        Entfernt alle Push-Benachrichtigungs-Abos auf diesem und allen anderen
        Geräten. Du bleibst angemeldet und kannst Push jederzeit wieder
        aktivieren.
      </p>
      <div class="row">
        <button
          type="button"
          mat-stroked-button
          color="warn"
          [disabled]="loading()"
          (click)="unsubscribeAll.emit()"
          i18n="@@unsubAll.button"
        >
          <mat-icon>notifications_off</mat-icon>
          Push auf allen Geräten deaktivieren
        </button>
      </div>
    </section>
  `,
  styles: `
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0;
    }
    .reminder-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      display: grid;
      gap: 14px;

      h3 {
        margin: 0;
      }
    }
  `,
})
export class UnsubscribeAllSectionComponent {
  readonly loading = input.required<boolean>();
  readonly unsubscribeAll = output<void>();
}
