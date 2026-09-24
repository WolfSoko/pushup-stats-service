import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { SessionStep } from '@pu-stats/models';
import { createKeyedBusyState } from '@pu-stats/ui';

import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { WakeLockService } from '../../core/wake-lock.service';
import { WORKOUT_SESSION_ENTRY_SOURCE } from '../../training-plans/session/session-capture.helpers';
import {
  SESSION_ENTRY_SOURCE_TOKEN,
  SessionCaptureService,
} from '../../training-plans/session/session-capture.service';
import { SessionIntroComponent } from '../../training-plans/session/session-intro.component';
import { SessionRestComponent } from '../../training-plans/session/session-rest.component';
import { SESSION_SOURCE } from '../../training-plans/session/session-source';
import {
  SessionStepComponent,
  type SessionStepAction,
} from '../../training-plans/session/session-step.component';
import { SessionSkeletonComponent } from '../../training-plans/session/session-skeleton.component';
import { TrainingSessionStore } from '../../training-plans/session/training-session.store';
import { buildSessionRows } from '../../training-plans/session/training-session.rows';
import { asSessionSource, WorkoutRunStore } from './workout-run.store';

/**
 * Guided session over one of the user's own workouts. The same step
 * machine, capture tools and rest countdown as the plan session; only
 * the source differs — the workout instead of today's plan day — and
 * hand ticks live in the run state rather than the plan document.
 */
@Component({
  selector: 'app-workout-session',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    RouterLink,
    SessionIntroComponent,
    SessionRestComponent,
    SessionSkeletonComponent,
    SessionStepComponent,
  ],
  providers: [
    WorkoutRunStore,
    {
      provide: SESSION_SOURCE,
      useFactory: () => asSessionSource(inject(WorkoutRunStore)),
    },
    {
      provide: SESSION_ENTRY_SOURCE_TOKEN,
      useValue: WORKOUT_SESSION_ENTRY_SOURCE,
    },
    TrainingSessionStore,
    SessionCaptureService,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workout-session.component.html',
  styleUrl: '../../training-plans/session/training-session.component.css',
})
export class WorkoutSessionComponent {
  protected readonly run = inject(WorkoutRunStore);
  protected readonly session = inject(TrainingSessionStore);
  private readonly capture = inject(SessionCaptureService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly busy = createKeyedBusyState<SessionStepAction>();
  protected readonly closeLabel = $localize`:@@session.close:Session beenden`;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  constructor() {
    inject(WakeLockService).keepAwakeWhile(
      () => this.session.phase() === 'rest'
    );
    effect(() => {
      const id = this.params().get('id');
      if (id) this.run.open(id);
    });
  }

  protected readonly rows = computed(() =>
    buildSessionRows(this.session.steps())
  );
  protected readonly overviewRows = computed(() =>
    buildSessionRows(this.session.overviewSteps())
  );
  protected readonly currentRow = computed(
    () => this.rows()[this.session.stepIndex()] ?? null
  );
  protected readonly progressPercent = computed(() => {
    const total = this.session.stepsTotal();
    if (total === 0) return 0;
    return Math.round((this.session.stepsDone() / total) * 100);
  });

  /** Start counting from now, then walk the first step. */
  begin(): void {
    this.run.start();
    this.session.begin();
  }

  captureCurrent(): Promise<void> {
    return this.runCapture('capture', (step) => this.capture.capture(step));
  }

  enterByHand(): Promise<void> {
    return this.runCapture('byHand', (step) =>
      this.capture.captureByHand(step)
    );
  }

  /**
   * One tap: write what this step still prescribes. A workout has no
   * plan item to tick, so every round — the last included — goes the
   * same way; the entry is what closes the step.
   */
  logAsPrescribed(): Promise<void> {
    return this.runCapture('prescribed', (step) =>
      this.capture.logPrescribed(step)
    );
  }

  /** Close the step without an entry. */
  checkOff(): void {
    const step = this.session.currentStep();
    if (!step || this.busy.busy()) return;
    this.run.tick(step.itemIndex);
    this.session.completeStep();
  }

  finish(): void {
    if (this.session.allDone()) this.run.finish();
    void this.router.navigateByUrl('/workouts');
  }

  private async runCapture(
    action: SessionStepAction,
    run: (step: SessionStep) => Promise<{ status: string; value: number }>
  ): Promise<void> {
    const step = this.session.currentStep();
    if (!step || this.busy.busy()) return;
    await this.busy.run(action, async () => {
      const outcome = await run(step);
      if (outcome.status !== 'captured') return;
      if (step.quantified && step.logged + outcome.value < step.target) return;
      this.session.completeStep();
    });
  }
}
