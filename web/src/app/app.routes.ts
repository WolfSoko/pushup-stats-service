import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./stats/shell/stats-dashboard.component').then((m) => m.StatsDashboardComponent),
  },
  {
    path: 'daten',
    loadComponent: () => import('./stats/shell/entries-page.component').then((m) => m.EntriesPageComponent),
  },
  { path: 'eintraege', redirectTo: 'daten' },
  {
    path: 'analyse',
    loadComponent: () => import('./stats/shell/analysis-page.component').then((m) => m.AnalysisPageComponent),
  },
  { path: '**', redirectTo: '' },
];
