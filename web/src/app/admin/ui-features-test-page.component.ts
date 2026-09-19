import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CheerAnimationStore } from '../core/cheer-animation.store';
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
    MatIconModule,
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
  `,
})
export class UiFeaturesTestPageComponent {
  private readonly cheerAnimation = inject(CheerAnimationStore);

  private readonly previewSender = $localize`:@@admin.uiFeatures.cheer.previewSender:Vorschau`;

  previewCheerAnimation(): void {
    this.cheerAnimation.play(this.previewSender);
  }
}
