import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthStore } from '@pu-auth/auth';
import { findPlanBySlug, SessionStep } from '@pu-stats/models';

import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { TrainingPlanStore } from '../training-plan.store';
import { isPlanActive } from '../training-plan-store.selectors';
import { SessionCaptureService } from './session-capture.service';
import { SessionIntroComponent } from './session-intro.component';
import { SessionRestComponent } from './session-rest.component';
import { SessionStepComponent } from './session-step.component';
import { TrainingSessionStore } from './training-session.store';
import { buildSessionRows } from './training-session.rows';

/**
 * Guided training session for today's plan day: exercise by exercise or
 * as a circuit, each step handed to the capture tool that fits it, with
 * a configurable pause in between.
 *
 * Nothing here is session-only state — every completed exercise is an
 * ordinary entry (or a plan tick), so leaving mid-workout and coming
 * back resumes exactly where the logged entries say the user stands.
 */
@Component({
  selector: 'app-training-session',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    RouterLink,
    SessionIntroComponent,
    SessionRestComponent,
    SessionStepComponent,
  ],
  providers: [TrainingSessionStore, SessionCaptureService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-session.component.html',
  styleUrl: './training-session.component.css',
})
export class TrainingSessionComponent {
  protected readonly session = inject(TrainingSessionStore);
  private readonly planStore = inject(TrainingPlanStore);
  private readonly capture = inject(SessionCaptureService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly authStore = inject(AuthStore);

  protected readonly isAuthenticated = this.authStore.isAuthenticated;
  protected readonly authResolved = this.authStore.authResolved;
  protected readonly planLoaded = this.planStore.activePlanLoaded;

  /** Blocks the step actions while a dialog or write is in flight. */
  protected readonly busy = signal(false);

  protected readonly closeLabel = $localize`:@@session.close:Session beenden`;

  private readonly slugSignal = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly plan = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? findPlanBySlug(slug) : null;
  });

  protected readonly planUrl = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? `/training-plans/${slug}` : '/training-plans';
  });

  /**
   * A session only makes sense for the plan the user is actually on —
   * walking day 3 of a plan they never started would write entries
   * against a prescription nothing tracks.
   */
  protected readonly isThisPlanActive = computed(() =>
    isPlanActive(this.plan(), this.planStore.activePlan())
  );

  protected readonly rows = computed(() =>
    buildSessionRows(this.session.steps())
  );

  /** The day's exercises for the start screen — one row per exercise, so
   *  a circuit doesn't list the same exercise once per round. */
  protected readonly overviewRows = computed(() =>
    buildSessionRows(this.session.overviewSteps())
  );

  protected readonly currentRow = computed(
    () => this.rows()[this.session.stepIndex()] ?? null
  );

  protected readonly dayDescription = computed(
    () => this.session.day()?.description ?? ''
  );

  protected readonly progressPercent = computed(() => {
    const total = this.session.stepsTotal();
    if (total === 0) return 0;
    return Math.round((this.session.stepsDone() / total) * 100);
  });

  /** Run the step's own tool. */
  captureCurrent(): Promise<void> {
    return this.runCapture((step) => this.capture.capture(step));
  }

  /** Open the entry dialog regardless of the step's primary tool. */
  enterByHand(): Promise<void> {
    return this.runCapture((step) => this.capture.captureByHand(step));
  }

  /**
   * One tap: write exactly what this step prescribes.
   *
   * Only the round that closes the plan item goes through the store's
   * tick-and-close path — ticking an item off after round one of a
   * circuit would swallow the rounds still to come.
   */
  async logAsPrescribed(): Promise<void> {
    if (this.session.currentStep()?.finalRound === false) {
      return this.runCapture((step) => this.capture.logPrescribed(step));
    }
    const step = this.session.currentStep();
    const dayIndex = this.session.dayIndex();
    if (!step || dayIndex === null || this.busy()) return;
    this.busy.set(true);
    try {
      const result = await this.planStore.logPlanExercise(
        dayIndex,
        step.itemIndex
      );
      if (result === 'logged' || result === 'already-logged') {
        this.session.completeStep();
        return;
      }
      this.notifyNotLogged();
    } catch {
      this.notifyNotLogged();
    } finally {
      this.busy.set(false);
    }
  }

  /** Close the step without an entry — the escape hatch for anything
   *  tracked outside the app. Ticks off the whole plan item, so in a
   *  circuit it closes that exercise's remaining rounds too. */
  async checkOff(): Promise<void> {
    const step = this.session.currentStep();
    const dayIndex = this.session.dayIndex();
    if (!step || dayIndex === null || this.busy()) return;
    this.busy.set(true);
    try {
      await this.planStore.setItemDone(dayIndex, step.itemIndex, true);
      this.session.completeStep();
    } catch {
      this.notifyNotLogged();
    } finally {
      this.busy.set(false);
    }
  }

  finish(): void {
    void this.router.navigateByUrl(this.planUrl());
  }

  /**
   * Advance only when the capture actually covered the step's target.
   * A set that fell short leaves the user on the same exercise with the
   * new partial progress showing, so they can top it up.
   */
  private async runCapture(
    run: (step: SessionStep) => Promise<{ status: string; value: number }>
  ): Promise<void> {
    const step = this.session.currentStep();
    if (!step || this.busy()) return;
    this.busy.set(true);
    try {
      const outcome = await run(step);
      if (outcome.status !== 'captured') return;
      if (step.quantified && step.logged + outcome.value < step.target) return;
      this.session.completeStep();
    } finally {
      this.busy.set(false);
    }
  }

  private notifyNotLogged(): void {
    this.snackbar.open(
      $localize`:@@session.notLogged:Konnte nicht eingetragen werden. Versuch es gleich nochmal.`,
      undefined,
      { duration: 3000 }
    );
  }
}
