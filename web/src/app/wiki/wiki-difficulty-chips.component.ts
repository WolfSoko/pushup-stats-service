import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import type { ExerciseDifficulty } from '@pu-stats/models';
import { XpRateBadgeComponent } from '../core/xp/xp-rate-badge.component';

/**
 * Difficulty chip of a wiki exercise or pushup type, followed by the XP
 * the exercise is worth per unit when `exerciseId` is given.
 */
@Component({
  selector: 'app-wiki-difficulty-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatChipsModule, XpRateBadgeComponent],
  template: `
    <mat-chip-set
      aria-label="Schwierigkeitsgrad"
      i18n-aria-label="@@wiki.difficulty.aria"
    >
      @if (difficulty() === 'beginner') {
        <mat-chip
          class="difficulty-chip beginner"
          i18n="@@wiki.pushupTypes.level.beginner"
          >Einsteiger</mat-chip
        >
      } @else if (difficulty() === 'intermediate') {
        <mat-chip
          class="difficulty-chip intermediate"
          i18n="@@wiki.pushupTypes.level.intermediate"
          >Mittelstufe</mat-chip
        >
      } @else {
        <mat-chip
          class="difficulty-chip advanced"
          i18n="@@wiki.pushupTypes.level.advanced"
          >Fortgeschritten</mat-chip
        >
      }
    </mat-chip-set>
    @if (exerciseId(); as id) {
      <app-xp-rate-badge [exerciseId]="id" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .difficulty-chip {
      font-size: 0.78rem;
      --mdc-chip-container-height: 24px;
    }
    .difficulty-chip.beginner {
      --mdc-chip-elevated-container-color: rgba(76, 175, 80, 0.18);
    }
    .difficulty-chip.intermediate {
      --mdc-chip-elevated-container-color: rgba(255, 167, 38, 0.2);
    }
    .difficulty-chip.advanced {
      --mdc-chip-elevated-container-color: rgba(244, 67, 54, 0.2);
    }
  `,
})
export class WikiDifficultyChipsComponent {
  readonly difficulty = input.required<ExerciseDifficulty>();
  readonly exerciseId = input<string | null>(null);
}
