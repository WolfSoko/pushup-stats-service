import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { resolveExerciseGuide } from './exercise-ref.model';

export interface ExerciseGuideDialogData {
  readonly exerciseId: string;
  readonly variantId?: string | null;
}

/**
 * The wiki's how-to for one exercise, in place: steps and tips without
 * leaving a running session or a half-edited workout. The full article is
 * one link away for whoever wants more.
 */
@Component({
  selector: 'app-exercise-guide-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule, RouterLink],
  template: `
    <h2 mat-dialog-title data-testid="exercise-guide-title">
      {{ guide.name }}
    </h2>
    <mat-dialog-content class="guide">
      @if (guide.summary) {
        <p class="summary">{{ guide.summary }}</p>
      }
      @if (guide.instructions.length > 0) {
        <h3 i18n="@@wiki.pushupTypes.instructionsTitle">Ausführung</h3>
        <ol data-testid="exercise-guide-steps">
          @for (step of guide.instructions; track $index) {
            <li>{{ step }}</li>
          }
        </ol>
      } @else {
        <p class="muted" i18n="@@exerciseGuide.empty">
          Für diese Übung gibt es noch keine Anleitung.
        </p>
      }
      @if (guide.tips.length > 0) {
        <h3 i18n="@@wiki.pushupTypes.tipsTitle">Tipps</h3>
        <ul>
          @for (tip of guide.tips; track $index) {
            <li>{{ tip }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a
        mat-button
        mat-dialog-close
        data-testid="exercise-guide-wiki"
        [routerLink]="guide.wikiLink"
      >
        <mat-icon>menu_book</mat-icon>
        <span i18n="@@exerciseGuide.toWiki">Im Wiki öffnen</span>
      </a>
      <button
        mat-flat-button
        color="primary"
        mat-dialog-close
        i18n="@@exerciseGuide.close"
      >
        Verstanden
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .guide {
      line-height: 1.55;
    }
    .summary {
      font-weight: 500;
      margin-top: 0;
    }
    h3 {
      margin: 16px 0 4px;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mat-sys-on-surface-variant);
    }
    ol,
    ul {
      margin: 0;
      padding-left: 22px;
    }
    li {
      margin-bottom: 4px;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ExerciseGuideDialogComponent {
  private readonly data = inject<ExerciseGuideDialogData>(MAT_DIALOG_DATA);
  protected readonly guide = resolveExerciseGuide(
    this.data.exerciseId,
    this.data.variantId,
    inject(LOCALE_ID)
  );
}
