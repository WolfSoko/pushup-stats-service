import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EnvironmentInjector,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BRAND_NAME } from '@pu-stats/models';

import { ShareService } from '../core/share.service';
import { snapElement } from '../core/snap-element';
import type { AchievementBadge } from '../public-profile/achievement-badge';

export const ACHIEVEMENT_SNAP_DURATION_MS = 4000;

export interface AchievementDialogData {
  readonly badge: AchievementBadge;
  /**
   * Where the share points. Deliberately the homepage, not the user's
   * profile: the profile is only reachable for opted-in users, and a
   * shared link to a private one is a 404 for the recipient. Opted-in
   * users still share their profile from the profile page itself.
   */
  readonly shareUrl: string;
  /**
   * DOM id of the title, for `ariaLabelledBy`. A badge can sync while an
   * earlier celebration is still open, so it must be unique per dialog.
   */
  readonly titleId: string;
  /** The user's snap-quality preset; the project default when omitted. */
  readonly maxParticleCount?: number;
}

const RAY_COUNT = 12;

function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

@Component({
  selector: 'app-achievement-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // No Material components: the card is rasterised by html2canvas on snap,
  // which cannot parse the color() functions in Material 3 tokens.
  imports: [],
  templateUrl: './achievement-dialog.component.html',
  styleUrl: './achievement-dialog.component.scss',
})
export class AchievementDialogComponent {
  protected readonly data = inject<AchievementDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AchievementDialogComponent>);
  private readonly shareService = inject(ShareService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly envInjector = inject(EnvironmentInjector);

  protected readonly cardRef =
    viewChild.required<ElementRef<HTMLElement>>('card');
  protected readonly snapping = signal(false);

  protected readonly rays = Array.from(
    { length: RAY_COUNT },
    (_, i) => (360 / RAY_COUNT) * i
  );

  protected readonly eyebrow = $localize`:@@achievement.dialog.eyebrow:Neues Abzeichen`;
  protected readonly headline = $localize`:@@achievement.dialog.headline:Geschafft!`;
  protected readonly note = $localize`:@@achievement.dialog.note:Ab jetzt glänzt es in deiner Sammlung. Weiter so!`;
  protected readonly closeAriaLabel = $localize`:@@achievement.dialog.closeAria:Schließen`;
  protected readonly shareLabel = $localize`:@@achievement.dialog.share:Teilen`;
  protected readonly snapLabel = $localize`:@@achievement.dialog.snap:Snap!`;
  protected readonly snapAriaLabel = $localize`:@@achievement.dialog.snapAria:Snap! – Abzeichen vaporisieren`;

  protected close(): void {
    if (this.snapping()) return;
    this.dialogRef.close();
  }

  protected async share(): Promise<void> {
    if (this.snapping()) return;
    await this.shareService.share({
      title: $localize`:@@achievement.share.title:${BRAND_NAME}:brand:`,
      text: $localize`:@@achievement.share.text:${this.data.badge.label}:badge: — geschafft! 💪`,
      url: this.data.shareUrl,
    });
    // The clipboard fallback keeps the dialog interactive while it awaits;
    // closing now would cut off a snap started in the meantime.
    if (this.snapping()) return;
    this.dialogRef.close();
  }

  protected async snap(): Promise<void> {
    if (this.snapping()) return;
    if (!isPlatformBrowser(this.platformId) || prefersReducedMotion()) {
      this.dialogRef.close();
      return;
    }
    this.snapping.set(true);
    const card = this.cardRef().nativeElement;
    // Set synchronously: html2canvas clones the card right away, before the
    // signal-driven class binding has necessarily rendered.
    card.classList.add('is-snapping');
    await snapElement(card, {
      injector: this.envInjector,
      durationMs: ACHIEVEMENT_SNAP_DURATION_MS,
      name: 'achievement-thanos',
      maxParticleCount: this.data.maxParticleCount,
      onDone: () => this.dialogRef.close(),
    });
  }
}
