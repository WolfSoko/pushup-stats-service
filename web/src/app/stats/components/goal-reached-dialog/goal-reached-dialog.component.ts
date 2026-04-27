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

export type GoalKind = 'daily' | 'weekly' | 'monthly';

export interface GoalReachedDialogData {
  readonly kind: GoalKind;
  readonly total: number;
  readonly goal: number;
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

interface GoalCopy {
  readonly icon: string;
  readonly title: string;
  readonly note: string;
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
  protected readonly data = inject<GoalReachedDialogData>(MAT_DIALOG_DATA);

  protected readonly cardRef =
    viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly snapping = signal(false);

  protected readonly copy = computed<GoalCopy>(() => {
    switch (this.data.kind) {
      case 'weekly':
        return {
          icon: 'military_tech',
          title: $localize`:@@goalReached.weekly.title:Wochenziel erreicht!`,
          note: $localize`:@@goalReached.weekly.note:Sieben Tage, ein Sieg. Du bist on fire.`,
        };
      case 'monthly':
        return {
          icon: 'workspace_premium',
          title: $localize`:@@goalReached.monthly.title:Monatsziel erreicht!`,
          note: $localize`:@@goalReached.monthly.note:Ein ganzer Monat Disziplin. Legendär.`,
        };
      default:
        return {
          icon: 'emoji_events',
          title: $localize`:@@goalReached.daily.title:Tagesziel erreicht!`,
          note: $localize`:@@goalReached.daily.note:Heute hast du dein Versprechen gehalten.`,
        };
    }
  });

  protected readonly snapAriaLabel = $localize`:@@goalReached.snapAria:Erfolg vaporisieren`;
  protected readonly snapLabel = $localize`:@@goalReached.snap:Snap!`;
  protected readonly closeAriaLabel = $localize`:@@goalReached.closeAria:Schließen`;
  protected readonly progressLabel = computed(
    () => `${this.data.total} / ${this.data.goal}`
  );

  protected onClose(): void {
    if (this.snapping()) return;
    this.dialogRef.close();
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
            useValue: createWsThanosOptions({ maxParticleCount }),
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
          .subscribe({ error: () => undefined });
      });
    } catch {
      this.dialogRef.close();
    }
  }
}
