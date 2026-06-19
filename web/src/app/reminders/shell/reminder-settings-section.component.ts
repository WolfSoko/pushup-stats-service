import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { NotificationPermissionStatus } from '@pu-reminders/reminders';
import { ReminderFormStore } from './reminder-form.store';
import { parseInputNumber, parseInputValue } from './reminders-page.helpers';

@Component({
  selector: 'app-reminder-settings-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  template: `
    <section class="reminder-section">
      <h3 i18n="@@reminder.section.title">🔔 Erinnerungen / Reminders</h3>

      <div class="reminder-row">
        <mat-slide-toggle
          [checked]="form.enabled()"
          (change)="reminderToggle.emit($event.checked)"
          i18n="@@reminder.enabled.label"
        >
          Liegestütz-Erinnerungen aktivieren
        </mat-slide-toggle>

        @if (permissionStatus() === 'denied') {
          <span
            class="permission-hint"
            i18n="@@reminder.permission.denied.hint"
          >
            <mat-icon>warning</mat-icon>
            Benachrichtigungen sind im Browser blockiert. Bitte in den
            Browser-Einstellungen erlauben.
          </span>
        } @else if (permissionStatus() === 'granted') {
          <span class="permission-ok">
            <mat-icon>check_circle</mat-icon>
            <span i18n="@@reminder.permission.granted"
              >Benachrichtigungen erlaubt</span
            >
          </span>
        } @else if (permissionStatus() === 'unsupported') {
          <span
            class="permission-hint"
            i18n="@@reminder.permission.unsupported"
          >
            <mat-icon>info</mat-icon>
            Dein Browser unterstützt keine Benachrichtigungen.
          </span>
        }
      </div>

      @if (form.enabled()) {
        <div class="reminder-grid">
          <div>
            <p class="field-label" i18n="@@reminder.interval.label">
              Erinnerungsintervall
            </p>
            <mat-chip-listbox
              [value]="form.intervalMinutes()"
              [disabled]="form.saving()"
              (change)="form.setInterval($event.value)"
              aria-label="Intervall-Voreinstellungen"
              i18n-aria-label="@@reminder.interval.aria"
            >
              <mat-chip-option [value]="30" i18n="@@reminder.interval.30min"
                >30 Min</mat-chip-option
              >
              <mat-chip-option [value]="60" i18n="@@reminder.interval.1h"
                >1 Std</mat-chip-option
              >
              <mat-chip-option [value]="120" i18n="@@reminder.interval.2h"
                >2 Std</mat-chip-option
              >
              <mat-chip-option [value]="240" i18n="@@reminder.interval.4h"
                >4 Std</mat-chip-option
              >
            </mat-chip-listbox>

            <mat-form-field appearance="outline" class="interval-custom">
              <mat-label i18n="@@reminder.interval.custom.label"
                >Benutzerdefiniert (Min)</mat-label
              >
              <input
                matInput
                type="number"
                min="15"
                max="480"
                [disabled]="form.saving()"
                [value]="form.intervalMinutes()"
                (input)="form.setInterval(asNumber($event))"
                (blur)="form.clampInterval()"
              />
              <mat-hint i18n="@@reminder.interval.hint"
                >15–480 Minuten</mat-hint
              >
            </mat-form-field>
          </div>

          <div>
            <p class="field-label" i18n="@@reminder.quickLog.label">
              Direkt-Eintrag aus der Benachrichtigung
            </p>
            <p class="muted" i18n="@@reminder.quickLog.desc">
              Zeigt einen "Eintragen"-Button auf der Push-Benachrichtigung. Wenn
              die App schon geöffnet ist, wird der Eintrag im Hintergrund
              gespeichert; ansonsten öffnet sich kurz ein Tab, der den Eintrag
              automatisch anlegt.
            </p>
            <div class="reminder-row">
              <mat-slide-toggle
                [checked]="form.quickLogEnabled()"
                [disabled]="form.saving()"
                (change)="form.setQuickLogEnabled($event.checked)"
                i18n="@@reminder.quickLog.toggle"
              >
                Schnell-Eintrag aktivieren
              </mat-slide-toggle>
              @if (form.quickLogEnabled()) {
                <mat-form-field appearance="outline" class="quick-log-field">
                  <mat-label i18n="@@reminder.quickLog.reps.label"
                    >Anzahl Liegestütze</mat-label
                  >
                  <input
                    matInput
                    type="number"
                    min="1"
                    max="500"
                    [disabled]="form.saving()"
                    [value]="form.quickLogReps()"
                    (input)="form.setQuickLogReps(asNumber($event))"
                    (blur)="form.clampQuickLogReps()"
                  />
                  <mat-hint i18n="@@reminder.quickLog.reps.hint"
                    >1–500 Wiederholungen</mat-hint
                  >
                </mat-form-field>
              }
            </div>
          </div>

          <div class="quiet-hours-section">
            <p class="field-label" i18n="@@reminder.quietHours.label">
              Ruhezeiten
            </p>
            @for (qh of form.quietHours(); track $index) {
              <div class="quiet-hour-row">
                <mat-form-field appearance="outline" class="time-field">
                  <mat-label i18n="@@reminder.quietHours.from">Von</mat-label>
                  <input
                    matInput
                    type="time"
                    [disabled]="form.saving()"
                    [value]="qh.from"
                    (change)="
                      form.updateQuietHour($index, 'from', asValue($event))
                    "
                  />
                </mat-form-field>
                <mat-form-field appearance="outline" class="time-field">
                  <mat-label i18n="@@reminder.quietHours.to">Bis</mat-label>
                  <input
                    matInput
                    type="time"
                    [disabled]="form.saving()"
                    [value]="qh.to"
                    (change)="
                      form.updateQuietHour($index, 'to', asValue($event))
                    "
                  />
                </mat-form-field>
                <button
                  type="button"
                  mat-icon-button
                  [disabled]="form.saving()"
                  (click)="form.removeQuietHour($index)"
                  aria-label="Ruhezeit entfernen"
                  i18n-aria-label="@@reminder.quietHours.remove.aria"
                >
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              </div>
            }
            <button
              type="button"
              mat-stroked-button
              [disabled]="form.saving()"
              (click)="form.addQuietHour()"
              i18n="@@reminder.quietHours.add"
            >
              <mat-icon>add</mat-icon>
              Ruhezeit hinzufügen
            </button>
          </div>
        </div>
      }

      <div class="row">
        <button
          type="button"
          mat-flat-button
          [disabled]="!form.canSave()"
          (click)="save.emit()"
          i18n="@@reminder.save"
        >
          <mat-icon>save</mat-icon>
          Erinnerungen speichern
        </button>
        @if (form.saved()) {
          <span class="muted" i18n="@@reminder.saved">Gespeichert.</span>
        }
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
    .reminder-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .reminder-grid {
      display: grid;
      gap: 18px;
    }
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .interval-custom {
      margin-top: 8px;
      max-width: 180px;
    }
    .quick-log-field {
      max-width: 180px;
    }
    .quiet-hours-section {
      display: grid;
      gap: 8px;
    }
    .quiet-hour-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .time-field {
      max-width: 130px;
    }
    .permission-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #ffb2b2;
    }
    .permission-ok {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #90ee90;
    }
  `,
})
export class ReminderSettingsSectionComponent {
  readonly form = inject(ReminderFormStore);
  readonly permissionStatus = input.required<NotificationPermissionStatus>();
  readonly reminderToggle = output<boolean>();
  readonly save = output<void>();

  asValue = parseInputValue;
  asNumber = parseInputNumber;
}
