import { Component } from '@angular/core';
import { StatsDashboardComponent } from './stats/shell/stats-dashboard.component';

@Component({
  selector: 'app-root',
  imports: [StatsDashboardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
