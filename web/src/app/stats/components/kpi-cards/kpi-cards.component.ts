import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-kpi-cards',
  imports: [MatCardModule],
  template: `
    <section class="kpis">
      <mat-card><span>Gesamt</span><b>{{ total }}</b></mat-card>
      <mat-card><span>Tage</span><b>{{ days }}</b></mat-card>
      <mat-card><span>Einträge</span><b>{{ entries }}</b></mat-card>
      <mat-card><span>Ø / Tag</span><b>{{ avg }}</b></mat-card>
    </section>
  `,
  styleUrl: './kpi-cards.component.scss',
})
export class KpiCardsComponent {
  @Input() total = 0;
  @Input() days = 0;
  @Input() entries = 0;
  @Input() avg = '0';
}
