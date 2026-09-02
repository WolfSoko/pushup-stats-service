import {
  ChangeDetectionStrategy,
  Component,
  computed,
  createEnvironmentInjector,
  ElementRef,
  EnvironmentInjector,
  inject,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DEFAULT_SNAP_QUALITY, SNAP_QUALITY_PARTICLES } from '@pu-stats/models';
import { finalize } from 'rxjs';
import { ShareService } from '../../../core/share.service';
import {
  type GoalCopy,
  type GoalKind,
  goalReachedCopy,
} from './goal-reached-copy';

const SHARE_URL = 'https://pushup-stats.com';

/**
 * Length of the @wolsok/thanos vaporize animation. The card's frame fade
 * is no longer time-driven via a parallel CSS transition; instead each
 * vaporize frame writes its normalized progress (`animationT`, 0..1) to
 * the `--snap-progress` custom property on the card, and SCSS reads that
 * to interpolate transform/opacity. So this constant is the sole source
 * of the celebration duration.
 */
export const GOAL_SNAP_DURATION_MS = 5000;

export type { GoalKind } from './goal-reached-copy';

/**
 * One exercise of today's training-plan day, pre-formatted in the
 * exercise's own unit. Structurally a subset of the plan page's
 * `DayExerciseRow`, so the notifier can hand those rows over as-is.
 */
export interface GoalReachedPlanItem {
  readonly name: string;
  readonly target: string;
  readonly logged: string;
  readonly sets: string;
  readonly quantified: boolean;
  readonly done: boolean;
}

export interface GoalReachedDialogData {
  readonly kind: GoalKind;
  readonly total: number;
  readonly goal: number;
  /**
   * Today's plan prescription, listed under the progress line so the
   * user sees which plan goals the celebrated total already covers.
   * Omitted (or empty) when no plan is active or today is a rest day.
   */
  readonly planItems?: ReadonlyArray<GoalReachedPlanItem>;
  /**
   * DOM id assigned to the dialog title element. Provided by the caller so
   * that `MatDialogConfig.ariaLabelledBy` can point at it. Multiple goal
   * dialogs (daily/weekly/monthly) can be open simultaneously, so the id
   * MUST be unique per instance.
   */
  readonly titleId: string;
  /**
   * Optional override for the @wolsok/thanos `maxParticleCount`. Falls back
   * to the project-wide default (`SNAP_QUALITY_PARTICLES[DEFAULT_SNAP_QUALITY]`)
   * when omitted so the dialog stays usable in isolation (e.g. Storybook,
   * manual smoke tests).
   */
  readonly maxParticleCount?: number;
}

@Component({
  selector: 'app-goal-reached-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Note: deliberately NO Material component imports. The vaporized subtree
  // must avoid Material 3 design tokens because html2canvas v1.x can't parse
  // modern CSS color() functions. We render with plain HTML + the globally
  // loaded Material Icons font (declared in index.html).
  imports: [],
  templateUrl: './goal-reached-dialog.component.html',
  styleUrl: './goal-reached-dialog.component.scss',
})
export class GoalReachedDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GoalReachedDialogComponent>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly shareService = inject(ShareService);
  protected readonly data = inject<GoalReachedDialogData>(MAT_DIALOG_DATA);

  protected readonly cardRef =
    viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly snapping = signal(false);

  protected readonly copy = computed<GoalCopy>(() =>
    goalReachedCopy(this.data.kind, this.data.total, this.data.goal)
  );
  protected readonly planItems = computed<ReadonlyArray<GoalReachedPlanItem>>(
    () => this.data.planItems ?? []
  );

  protected readonly snapAriaLabel = $localize`:@@goalReached.snapAria:Erfolg vaporisieren`;
  protected readonly snapLabel = $localize`:@@goalReached.snap:Snap!`;
  protected readonly closeAriaLabel = $localize`:@@goalReached.closeAria:Schließen`;
  protected readonly shareAriaLabel = $localize`:@@goalReached.shareAria:Erfolg teilen`;
  protected readonly shareLabel = $localize`:@@goalReached.share:Teilen`;
  protected readonly planHeading = $localize`:@@goalReached.plan.heading:Deine Planziele heute`;
  protected readonly planDoneLabel = $localize`:@@goalReached.plan.done:erledigt`;
  protected readonly planOpenLabel = $localize`:@@goalReached.plan.open:offen`;
  protected readonly progressLabel = computed(
    () => `${this.data.total} / ${this.data.goal}`
  );

  protected onClose(): void {
    if (this.snapping()) return;
    this.dialogRef.close();
  }

  protected async onShare(): Promise<void> {
    if (this.snapping()) return;
    const { shareTitle, shareText } = this.copy();
    await this.shareService.share({
      title: shareTitle,
      text: shareText,
      url: SHARE_URL,
    });
  }

  protected async onSnap(): Promise<void> {
    if (this.snapping()) return;
    if (!isPlatformBrowser(this.platformId)) {
      this.dialogRef.close();
      return;
    }
    this.snapping.set(true);
    try {
      const el = this.cardRef().nativeElement;
      const {
        WsThanosService,
        WS_THANOS_OPTIONS_TOKEN,
        createWsThanosOptions,
      } = await import('@wolsok/thanos');
      // Build a child environment injector so the user's snap-quality
      // preset is honoured per-dialog without touching the root
      // WsThanosService instance (whose options are frozen at first use).
      const maxParticleCount =
        this.data.maxParticleCount ??
        SNAP_QUALITY_PARTICLES[DEFAULT_SNAP_QUALITY];
      const childEnv = createEnvironmentInjector(
        [
          WsThanosService,
          {
            provide: WS_THANOS_OPTIONS_TOKEN,
            useValue: createWsThanosOptions({
              animationLength: GOAL_SNAP_DURATION_MS,
              maxParticleCount,
            }),
          },
        ],
        this.envInjector,
        'goal-reached-thanos'
      );
      runInInjectionContext(childEnv, () => {
        inject(WsThanosService)
          .vaporize(el)
          // Close on completion AND on error (html2canvas can throw on
          // unsupported CSS like modern color() functions) — single teardown
          // path via finalize keeps both branches in sync.
          .pipe(
            finalize(() => {
              childEnv.destroy();
              this.dialogRef.close();
            })
          )
          .subscribe({
            // Drive the frame's transform/opacity off the actual particle
            // progress instead of a parallel CSS transition. Clamped to
            // 0..1 because the last frame can emit animationT slightly > 1
            // before the stream completes.
            next: (state) => {
              const t = Math.min(1, Math.max(0, state.animationT));
              el.style.setProperty('--snap-progress', String(t));
            },
            error: () => undefined,
          });
      });
    } catch {
      this.dialogRef.close();
    }
  }
}
