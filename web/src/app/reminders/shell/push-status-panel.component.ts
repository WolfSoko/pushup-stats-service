import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { PushStatus } from '@pu-push/push';
import { BusyDirective, SkeletonComponent } from '@pu-stats/ui';

@Component({
  selector: 'app-push-status-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BusyDirective, MatButtonModule, MatIconModule, SkeletonComponent],
  template: `
    <section
      id="reminders"
      class="reminder-section"
      [attr.aria-busy]="resolving() ? 'true' : null"
    >
      <h3 i18n="@@push.section.title">🔔 Erinnerungen</h3>
      <p class="muted" i18n="@@push.section.desc">
        Wir tippen dir auf die Schulter, wenn es Zeit für Liegestütze ist.
      </p>

      @if (status() === 'unsupported') {
        <p class="permission-hint" i18n="@@push.status.unsupported">
          <mat-icon>info</mat-icon>
          Dein Browser unterstützt keine Push-Benachrichtigungen.
        </p>
      } @else if (status() === 'denied') {
        <p class="permission-hint" i18n="@@push.status.denied">
          <mat-icon>warning</mat-icon>
          Push-Benachrichtigungen sind blockiert. Bitte in den
          Browser-Einstellungen erlauben.
        </p>
      } @else if (status() === 'browser-invalidated') {
        <p class="permission-hint" i18n="@@push.status.browserInvalidated">
          <mat-icon>warning</mat-icon>
          Dein Browser hat das Push-Abo für dieses Gerät als dauerhaft ungültig
          markiert. Bitte setze die Benachrichtigungs-Einstellungen für diese
          Seite in den Browser-Einstellungen zurück (Chrome → Einstellungen →
          Website-Einstellungen → Benachrichtigungen) und aktiviere Push danach
          erneut.
        </p>
      } @else if (status() === 'subscribed') {
        <div class="row">
          <span class="permission-ok">
            <mat-icon>notifications_active</mat-icon>
            <span i18n="@@push.status.subscribed">Erinnerungen aktiv ✓</span>
          </span>
          <button
            type="button"
            mat-stroked-button
            data-testid="push-unsubscribe"
            [disabled]="
              status() === 'loading' && !busyKeys().has('unsubscribe')
            "
            [puBusy]="busyKeys().has('unsubscribe')"
            (click)="unsubscribe.emit()"
            i18n="@@push.unsubscribe"
          >
            <mat-icon>notifications_off</mat-icon>
            Deaktivieren
          </button>
        </div>
        @if (deviceCount() > 1) {
          <p class="device-count-hint muted">
            <mat-icon>devices</mat-icon>
            <span i18n="@@push.device.count">
              Aktiv auf {{ deviceCount() }} Geräten
            </span>
          </p>
        }
      } @else if (resolving()) {
        <div class="skeleton" data-testid="push-status-skeleton">
          <pu-skeleton shape="title" width="40%" />
          <pu-skeleton width="70%" />
          <pu-skeleton shape="rect" width="180px" height="40px" />
        </div>
      } @else {
        <p class="muted" i18n="@@push.cta.desc">
          Nie wieder eine Einheit verpassen.
        </p>
        <button
          type="button"
          mat-flat-button
          color="primary"
          data-testid="push-subscribe"
          [disabled]="status() === 'loading' && !busyKeys().has('subscribe')"
          [puBusy]="busyKeys().has('subscribe')"
          (click)="subscribe.emit()"
          i18n="@@push.subscribe"
        >
          <mat-icon>notifications</mat-icon>
          Push aktivieren
        </button>
      }
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
    .skeleton {
      display: grid;
      gap: 10px;
    }
    .device-count-hint {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class PushStatusPanelComponent {
  readonly status = input.required<PushStatus>();
  readonly deviceCount = input.required<number>();
  /** The push action in flight, if any — only the pressed button spins. */
  readonly busyKeys = input<ReadonlySet<'subscribe' | 'unsubscribe'>>(
    new Set()
  );
  /**
   * The initial status probe. A `loading` caused by a pressed button keeps
   * that button's panel, so the spinner stays where the user clicked.
   */
  protected readonly resolving = computed(
    () => this.status() === 'loading' && this.busyKeys().size === 0
  );
  readonly subscribe = output<void>();
  readonly unsubscribe = output<void>();
}
