import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthStore } from '@pu-auth/auth';
import { findPlanBySlug } from '@pu-stats/models';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { TrainingPlanStore } from './training-plan.store';
import {
  buildWeeks,
  formatSets,
  messageForLogResult,
} from './training-plan-detail.helpers';

@Component({
  selector: 'app-training-plan-detail',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-plan-detail.component.html',
  styleUrl: './training-plan-detail.component.css',
})
export class TrainingPlanDetailComponent {
  protected readonly store = inject(TrainingPlanStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly authStore = inject(AuthStore);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isAuthenticated = this.authStore.isAuthenticated;
  protected readonly authResolved = this.authStore.authResolved;

  protected readonly formatSets = formatSets;

  /** Hides the hero `<figure>` when the Unsplash image fails to load. */
  protected readonly heroImageFailed = signal(false);

  private readonly slugSignal = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParamsSignal = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly plan = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? findPlanBySlug(slug) : null;
  });

  readonly signupQueryParams = computed(() => {
    const p = this.plan();
    return p
      ? { planId: p.id, returnUrl: `/training-plans/${p.slug}?autoStart=1` }
      : { returnUrl: '/training-plans' };
  });

  readonly loginQueryParams = computed(() => {
    const p = this.plan();
    // Intentionally NO `autoStart=1` here: a returning user logging back
    // in might already have a different active plan, and silently
    // replacing it would bypass the in-UI replacement warning shown for
    // manual starts. Send them back to the detail page so they can
    // explicitly confirm via "Plan starten".
    return p
      ? { returnUrl: `/training-plans/${p.slug}` }
      : { returnUrl: '/training-plans' };
  });

  private autoStartTriggered = false;

  constructor() {
    // Honour an incoming `?day=<index>` query param so deep-links from
    // the dashboard's plan banner scroll to the active day after route
    // hydration. Use `Element.scrollIntoView` (not `ViewportScroller`)
    // because the app shell wraps content in `<mat-sidenav-content>`,
    // which owns its own scroll container — `ViewportScroller` only
    // scrolls `window` and would silently no-op.
    //
    // We intentionally do NOT strip `?day=` after scrolling: keeping it
    // in the URL makes the deep-link bookmarkable and re-fires the
    // scroll on Back/Forward navigation, matching the `?type=` pattern
    // in the wiki pushup-types page.
    afterRenderEffect(() => {
      if (!this.isBrowser) return;
      const raw = this.queryParamsSignal().get('day');
      if (!raw) return;
      const target = document.getElementById(`day-${raw}`);
      if (target && this.host.nativeElement.contains(target)) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    effect(() => {
      const p = this.plan();
      const wantsAutoStart = this.queryParamsSignal().get('autoStart') === '1';
      // Defense-in-depth: even with `autoStart=1` (only set by the
      // signup flow), refuse to silently replace a *different* active
      // plan. Force the user through the manual flow that surfaces the
      // replacement warning. Also wait until the active-plan resource
      // has emitted at least once — otherwise during the initial-fetch
      // window `!isThisPlanActive()` is true even for a plan that's
      // already active, and we'd race the listener and overwrite it.
      const wouldReplaceDifferentPlan =
        this.store.hasActivePlan() && !this.isThisPlanActive();
      if (
        p &&
        wantsAutoStart &&
        this.authResolved() &&
        this.isAuthenticated() &&
        this.store.activePlanLoaded() &&
        !this.isThisPlanActive() &&
        !wouldReplaceDifferentPlan &&
        !this.autoStartTriggered
      ) {
        this.autoStartTriggered = true;
        // Surface failures with a snackbar so the user knows to retry
        // manually. The flag stays set to prevent a tight retry loop
        // inside this component instance — a manual reload will
        // re-attempt because `?autoStart=1` is still in the URL until
        // a successful start clears it.
        this.start().catch((error) => {
          console.error('Auto-start failed', error);
          this.snackbar.open(
            $localize`:@@trainingPlans.autoStartFailed:Plan-Start fehlgeschlagen — bitte erneut versuchen.`,
            undefined,
            { duration: 4000 }
          );
        });
      }
    });
  }

  readonly isThisPlanActive = computed(() => {
    const p = this.plan();
    const a = this.store.activePlan();
    return !!p && !!a && a.planId === p.id && a.status === 'active';
  });

  readonly weeks = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    const active = this.isThisPlanActive();
    return buildWeeks(
      plan,
      {
        currentDay: active ? this.store.currentDayIndex() : null,
        completed: new Set(
          active ? (this.store.activePlan()?.completedDays ?? []) : []
        ),
        skipped: new Set(
          active ? (this.store.activePlan()?.skippedDays ?? []) : []
        ),
      },
      this.locale
    );
  });

  async start(): Promise<void> {
    const p = this.plan();
    if (!p) return;
    if (!this.isAuthenticated()) {
      void this.router.navigate(['/register'], {
        queryParams: this.signupQueryParams(),
      });
      return;
    }
    await this.store.start(p.id);
    this.snackbar.open(
      $localize`:@@trainingPlans.started:Plan gestartet — viel Erfolg!`,
      undefined,
      { duration: 3000 }
    );
    if (this.queryParamsSignal().get('autoStart') === '1') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { autoStart: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  async abandon(): Promise<void> {
    await this.store.abandon();
    this.snackbar.open(
      $localize`:@@trainingPlans.abandoned:Plan beendet.`,
      undefined,
      { duration: 3000 }
    );
    void this.router.navigate(['/training-plans']);
  }

  async mark(dayIndex: number): Promise<void> {
    await this.store.markDayDone(dayIndex);
  }

  async unmark(dayIndex: number): Promise<void> {
    await this.store.unmarkDayDone(dayIndex);
  }

  async skip(dayIndex: number): Promise<void> {
    await this.store.skipDay(dayIndex);
    this.snackbar.open(
      $localize`:@@trainingPlans.skipped:Tag übersprungen.`,
      undefined,
      { duration: 2000 }
    );
  }

  async unskip(dayIndex: number): Promise<void> {
    await this.store.unskipDay(dayIndex);
  }

  async jumpToDay(dayIndex: number): Promise<void> {
    await this.store.jumpToDay(dayIndex);
    this.snackbar.open(
      $localize`:@@trainingPlans.jumped:Auf Tag ${dayIndex}:INTERPOLATION: gesprungen.`,
      undefined,
      { duration: 2500 }
    );
  }

  async logPlanDay(dayIndex: number): Promise<void> {
    const result = await this.store.logPlanDay(dayIndex);
    const message = messageForLogResult(result);
    if (message) {
      this.snackbar.open(message, undefined, { duration: 3000 });
    }
  }
}
