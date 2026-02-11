import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-entries-page',
  imports: [MatCardModule],
  template: `
    <main class="page-wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Einträge</mat-card-title>
          <mat-card-subtitle>Detailansicht für Filter, Bulk-Aktionen und volle Verwaltung (Skeleton)</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Als Nächstes: Filter (Datum/Quelle/Reps), Bulk-Aktionen und vollständige Eintragsverwaltung.</p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
  `,
})
export class EntriesPageComponent {}
