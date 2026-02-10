import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-kpi-cards',
  imports: [MatCardModule],
  template: `
    <section class="kpis">
      <mat-card class="kpi-card primary">
        <span>Gesamt</span>
        <b>{{ total() }}</b>
      </mat-card>
      <mat-card class="kpi-card">
        <span>Tage</span>
        <b>{{ days() }}</b>
      </mat-card>
      <mat-card class="kpi-card">
        <span>Einträge</span>
        <b>{{ entries() }}</b>
      </mat-card>
      <mat-card class="kpi-card accent">
        <span>Ø / Tag</span>
        <b>{{ avg() }}</b>
      </mat-card>
    </section>
  `,
  styleUrl: './kpi-cards.component.scss',
})
export class KpiCardsComponent {
  readonly total = input(0);
  readonly days = input(0);
  readonly entries = input(0);
  readonly avg = input('0');
}
