import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { StopwatchSignalService } from './stopwatch-signal.service';
import {
  formatStopwatch,
  StopwatchState,
  TargetSignal,
} from './stopwatch.state';

/**
 * Elapsed display, optional target line and start/pause/reset for a
 * {@link StopwatchState} the parent owns. The parent keeps the state so
 * it can read the final seconds (dialog save) or mirror them into form
 * fields (entry dialog) without reaching into the view.
 */
@Component({
  selector: 'app-stopwatch',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stopwatch.component.html',
  styleUrl: './stopwatch.component.css',
})
export class StopwatchComponent {
  readonly state = input.required<StopwatchState>();
  /** Prescribed seconds; 0 hides the target line. */
  readonly targetSec = input(0);

  /** Whole seconds, emitted on every change so a form can mirror them. */
  readonly elapsedSecChange = output<number>();

  protected readonly elapsedSec = computed(() => this.state().elapsedSec());
  protected readonly running = computed(() => this.state().running());
  protected readonly display = computed(() =>
    formatStopwatch(this.elapsedSec())
  );
  protected readonly targetDisplay = computed(() =>
    formatStopwatch(this.targetSec())
  );
  protected readonly reached = computed(
    () => this.targetSec() > 0 && this.elapsedSec() >= this.targetSec()
  );
  protected readonly canReset = computed(
    () => this.elapsedSec() > 0 || this.running()
  );

  protected readonly startLabel = $localize`:@@stopwatch.start:Start`;
  protected readonly pauseLabel = $localize`:@@stopwatch.pause:Pause`;
  protected readonly resetLabel = $localize`:@@stopwatch.reset:Zurücksetzen`;

  constructor() {
    const signals = inject(StopwatchSignalService);
    const target = new TargetSignal(() => signals.play());
    effect(() => target.update(this.reached()));
    effect(() => this.elapsedSecChange.emit(this.elapsedSec()));
  }
}
