import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-analysis-page',
  imports: [MatCardModule],
  template: `
    <main class="page-wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Analyse</mat-card-title>
          <mat-card-subtitle>Trends, Heatmap, Bestwerte und Streaks folgen im nächsten Schritt.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Skeleton steht. Als Nächstes kommen Wochen-/Monats-Trends und Heatmap.</p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
    }
  `,
})
export class AnalysisPageComponent {}
