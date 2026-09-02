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
import { MatTooltipModule } from '@angular/material/tooltip';

import { SessionStepRow } from './training-session.rows';

/**
 * The exercise currently in focus. Purely presentational — the page owns
 * the capture flow and the store writes.
 *
 * The primary button is whichever tool the exercise's measurement calls
 * for; the entry dialog, the one-tap "as prescribed" write and the plain
 * tick are always available underneath, so no exercise is ever a dead end
 * when the camera won't cooperate.
 */
@Component({
  selector: 'app-session-step',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-step.component.html',
  styleUrl: './session-step.component.css',
})
export class SessionStepComponent {
  readonly row = input.required<SessionStepRow>();
  /** 1-based position for the "Übung 2 von 3" line. */
  readonly position = input.required<number>();
  readonly total = input.required<number>();
  /** Blocks every action while a capture or write is in flight. */
  readonly busy = input(false);

  readonly capture = output<void>();
  readonly enterByHand = output<void>();
  readonly logAsPrescribed = output<void>();
  readonly checkOff = output<void>();
  readonly skip = output<void>();

  protected readonly toolLabel = computed(() => {
    switch (this.row().tool) {
      case 'auto-count':
        return $localize`:@@session.tool.autoCount:Mit Kamera zählen`;
      case 'hold-timer':
        return $localize`:@@session.tool.holdTimer:Timer starten`;
      case 'stopwatch':
        return $localize`:@@session.tool.stopwatch:Stoppuhr starten`;
      default:
        return $localize`:@@session.tool.manual:Eintragen`;
    }
  });

  protected readonly toolIcon = computed(() => {
    switch (this.row().tool) {
      case 'auto-count':
        return 'photo_camera';
      case 'hold-timer':
      case 'stopwatch':
        return 'timer';
      default:
        return 'edit';
    }
  });

  /** The entry dialog is the primary action already — don't offer it twice. */
  protected readonly showByHand = computed(() => this.row().tool !== 'manual');

  protected readonly hasProgress = computed(
    () => this.row().quantified && this.row().percent > 0
  );
}
