import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';

import { formatCountdown, SessionStepRow } from './training-session.rows';
import {
  SESSION_REST_MAX_SEC,
  SESSION_REST_MIN_SEC,
  SESSION_REST_STEP_SEC,
  type SessionMode,
} from '@pu-stats/models';

/**
 * The session start screen: what today asks for, in which order it will
 * be walked, and how long the pauses in between should be.
 *
 * Both settings live here rather than mid-workout because each is a
 * decision about the whole session; the countdown itself can still be
 * stretched or cut short while it runs.
 */
@Component({
  selector: 'app-session-intro',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSliderModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-intro.component.html',
  styleUrl: './session-intro.component.css',
})
export class SessionIntroComponent {
  readonly rows = input.required<ReadonlyArray<SessionStepRow>>();
  readonly description = input('');
  readonly restSec = input.required<number>();
  readonly mode = input.required<SessionMode>();
  /** Rounds a circuit of this day would walk, for the mode hint. */
  readonly roundTotal = input(1);

  readonly restSecChange = output<number>();
  readonly modeChange = output<SessionMode>();
  readonly start = output<void>();

  protected readonly min = SESSION_REST_MIN_SEC;
  protected readonly max = SESSION_REST_MAX_SEC;
  protected readonly step = SESSION_REST_STEP_SEC;

  protected readonly formatRest = formatCountdown;

  protected onRestInput(value: number): void {
    this.restSecChange.emit(value);
  }
}
