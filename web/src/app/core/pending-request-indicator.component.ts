import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PendingRequestsService } from '@pu-stats/data-access';

/**
 * Small toolbar spinner for any request that has been in flight longer
 * than {@link PENDING_INDICATOR_DELAY_MS}. Mounted once in the app shell;
 * the timing lives in {@link PendingRequestsService}.
 */
@Component({
  selector: 'app-pending-request-indicator',
  imports: [MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pending.visible()) {
      <mat-spinner
        class="pending-request-indicator"
        diameter="20"
        data-testid="pending-request-indicator"
        aria-label="Anfrage wird verarbeitet"
        i18n-aria-label="@@pendingRequest.indicatorAria"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
    /* The toolbar lays its children out with a gap; an empty host must
       not claim one. */
    :host:empty {
      display: none;
    }
    .pending-request-indicator {
      animation: pending-request-fade-in 150ms ease-out;
    }
    @keyframes pending-request-fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
})
export class PendingRequestIndicatorComponent {
  protected readonly pending = inject(PendingRequestsService);
}
