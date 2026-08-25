import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { formatCountdown, SessionStepRow } from './training-session.rows';

/** How much a single nudge stretches or shortens the countdown. */
const NUDGE_SEC = 15;

/**
 * The pause between two exercises. Counts down on its own (the store
 * owns the timer) and names what is coming up, so the user can set up
 * for the next exercise instead of watching a number.
 */
@Component({
  selector: 'app-session-rest',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-rest.component.html',
  styleUrl: './session-rest.component.css',
})
export class SessionRestComponent {
  readonly remainingSec = input.required<number>();
  /** Full rest duration, for the drain bar. */
  readonly totalSec = input.required<number>();
  /** The exercise the countdown leads into; absent on the last step. */
  readonly next = input<SessionStepRow | null>(null);

  readonly nudge = output<number>();
  readonly skipRest = output<void>();

  protected readonly nudgeSec = NUDGE_SEC;
  protected readonly shortenLabel = $localize`:@@session.rest.shortenAria:Pause um ${NUDGE_SEC}:INTERPOLATION: Sekunden verkürzen`;
  protected readonly extendLabel = $localize`:@@session.rest.extendAria:Pause um ${NUDGE_SEC}:INTERPOLATION: Sekunden verlängern`;
  protected readonly countdown = computed(() =>
    formatCountdown(this.remainingSec())
  );

  /** Drains from 100 to 0; stays full when no duration was configured. */
  protected readonly percent = computed(() => {
    const total = this.totalSec();
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (this.remainingSec() / total) * 100));
  });
}
