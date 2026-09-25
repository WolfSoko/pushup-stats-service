import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import {
  INVITE_ACHIEVEMENTS,
  PLAN_DAY_ACHIEVEMENTS,
  planCompletedAchievementId,
} from '@pu-stats/models';
import { AchievementCelebrationService } from '../achievements/achievement-celebration.service';
import { CheerAnimationStore } from '../core/cheer-animation.store';
import { XpCelebrationService } from '../core/xp/xp-celebration.service';
import { resolveAchievementBadges } from '../public-profile/achievement-badge';
import { PageHeaderComponent } from '../core/page-header/page-header.component';

/**
 * Admin-only preview ground for UI features that are hard to trigger
 * naturally (a friend's cheer, a rare celebration) — each card fires the
 * real overlay directly through its store, bypassing whatever event or
 * user setting normally gates it.
 */
@Component({
  selector: 'app-ui-features-test-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    RouterLink,
    PageHeaderComponent,
  ],
  template: `
    <div class="ui-features-page">
      <app-page-header icon="science" variant="admin">
        <h1 page-title i18n="@@admin.uiFeatures.title">UI-Features testen</h1>
        <p page-subtitle i18n="@@admin.uiFeatures.subtitle">
          Animationen und Overlays ohne den auslösenden Fall vorschauen.
        </p>
      </app-page-header>

      <a mat-button routerLink="/admin">
        <mat-icon>arrow_back</mat-icon>
        <span i18n="@@admin.uiFeatures.backToAdmin"
          >Zurück zum Admin-Bereich</span
        >
      </a>

      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@admin.uiFeatures.cheer.title"
            >Anfeuerungs-Feuerwerk</mat-card-title
          >
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@admin.uiFeatures.cheer.description">
            Zeigt die Feuerwerk-Animation, die beim Anfeuern durch einen Freund
            erscheint — unabhängig von der eigenen Animations-Einstellung.
          </p>
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-flat-button
            type="button"
            data-testid="preview-cheer-animation"
            (click)="previewCheerAnimation()"
          >
            <mat-icon>celebration</mat-icon>
            <span i18n="@@admin.uiFeatures.cheer.preview"
              >Vorschau starten</span
            >
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@admin.uiFeatures.badge.title"
            >Abzeichen-Dialog</mat-card-title
          >
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@admin.uiFeatures.badge.description">
            Öffnet den Dialog, der beim Verdienen eines Abzeichens erscheint —
            inklusive Snap. Die Vorschau zählt nicht als gefeiert.
          </p>
          <mat-form-field class="badge-select">
            <mat-label i18n="@@admin.uiFeatures.badge.select"
              >Abzeichen</mat-label
            >
            <mat-select
              data-testid="preview-badge-select"
              [value]="selectedBadgeId()"
              (selectionChange)="selectedBadgeId.set($event.value)"
            >
              @for (badge of previewBadges; track badge.id) {
                <mat-option [value]="badge.id">{{ badge.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-flat-button
            type="button"
            data-testid="preview-badge-dialog"
            (click)="previewBadgeDialog()"
          >
            <mat-icon>workspace_premium</mat-icon>
            <span i18n="@@admin.uiFeatures.badge.preview"
              >Vorschau starten</span
            >
          </button>
        </mat-card-actions>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@admin.uiFeatures.xp.title"
            >XP-Erfolgsdialog</mat-card-title
          >
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@admin.uiFeatures.xp.description">
            Öffnet den Dialog, der nach dem Speichern eines Eintrags die
            verdienten XP zeigt — mit Beispielwerten, wahlweise mit Level-Up.
          </p>
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-flat-button
            type="button"
            data-testid="preview-xp-dialog"
            (click)="previewXpDialog(false)"
          >
            <mat-icon>bolt</mat-icon>
            <span i18n="@@admin.uiFeatures.xp.preview">XP-Dialog</span>
          </button>
          <button
            mat-stroked-button
            type="button"
            data-testid="preview-xp-level-up"
            (click)="previewXpDialog(true)"
          >
            <mat-icon>military_tech</mat-icon>
            <span i18n="@@admin.uiFeatures.xp.previewLevelUp"
              >Mit Level-Up</span
            >
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .ui-features-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem;
      display: grid;
      gap: 1rem;
    }
    .badge-select {
      width: 100%;
      max-width: 360px;
    }
  `,
})
export class UiFeaturesTestPageComponent {
  private readonly cheerAnimation = inject(CheerAnimationStore);
  private readonly achievements = inject(AchievementCelebrationService);
  private readonly xpCelebration = inject(XpCelebrationService);

  private readonly previewSender = $localize`:@@admin.uiFeatures.cheer.previewSender:Vorschau`;

  // Plan-completed labels are generic, so any plan id previews that badge.
  protected readonly previewBadges = resolveAchievementBadges([
    ...PLAN_DAY_ACHIEVEMENTS.map((a) => a.id),
    planCompletedAchievementId('preview'),
    ...INVITE_ACHIEVEMENTS.map((a) => a.id),
  ]);
  protected readonly selectedBadgeId = signal(this.previewBadges[0].id);

  previewCheerAnimation(): void {
    this.cheerAnimation.play(this.previewSender);
  }

  previewXpDialog(levelUp: boolean): void {
    this.xpCelebration.showPreview(levelUp);
  }

  previewBadgeDialog(): void {
    const badge = this.previewBadges.find(
      (entry) => entry.id === this.selectedBadgeId()
    );
    if (badge) this.achievements.show(badge);
  }
}
