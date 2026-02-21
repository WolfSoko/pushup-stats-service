import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-kpi-cards',
  imports: [MatCardModule],
  template: `
    <section class="kpis">
      <mat-card class="kpi-card primary">
        <mat-card-header>
          <mat-card-title i18n="@@kpi.total">Gesamt</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <b>{{ total() }}</b>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card">
        <mat-card-header>
          <mat-card-title i18n="@@kpi.days">Tage</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <b>{{ days() }}</b>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card">
        <mat-card-header>
          <mat-card-title i18n="@@kpi.entries">Einträge</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <b>{{ entries() }}</b>
        </mat-card-content>
      </mat-card>
      <mat-card class="kpi-card accent">
        <mat-card-header>
          <mat-card-title i18n="@@kpi.avg">Ø / Tag</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <b>{{ avg() }}</b>
        </mat-card-content>
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
