import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';

import { formatCountdown, SessionStepRow } from './training-session.rows';
import {
  SESSION_REST_MAX_SEC,
  SESSION_REST_MIN_SEC,
  SESSION_REST_STEP_SEC,
} from '@pu-stats/models';

/**
 * The session start screen: what today asks for, and how long the pauses
 * between the exercises should be.
 *
 * The rest duration is set here rather than mid-workout because it is a
 * decision about the whole session; the countdown itself can still be
 * stretched or cut short while it runs.
 */
@Component({
  selector: 'app-session-intro',
  imports: [MatButtonModule, MatIconModule, MatSliderModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-intro.component.html',
  styleUrl: './session-intro.component.css',
})
export class SessionIntroComponent {
  readonly rows = input.required<ReadonlyArray<SessionStepRow>>();
  readonly description = input('');
  readonly restSec = input.required<number>();

  readonly restSecChange = output<number>();
  readonly start = output<void>();

  protected readonly min = SESSION_REST_MIN_SEC;
  protected readonly max = SESSION_REST_MAX_SEC;
  protected readonly step = SESSION_REST_STEP_SEC;

  protected readonly formatRest = formatCountdown;

  protected onRestInput(value: number): void {
    this.restSecChange.emit(value);
  }
}
