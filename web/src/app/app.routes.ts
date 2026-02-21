import { Routes } from '@angular/router';
import { AuthGuard } from './auth.guard'; // Import the AuthGuard

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./stats/shell/stats-dashboard.component').then(
        (m) => m.StatsDashboardComponent
      ),
  },
  {
    path: 'data',
    loadComponent: () =>
      import('./stats/shell/entries-page.component').then(
        (m) => m.EntriesPageComponent
      ),
  },
  {
    path: 'analysis',
    loadComponent: () =>
      import('./stats/shell/analysis-page.component').then(
        (m) => m.AnalysisPageComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./stats/shell/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
    canActivate: [AuthGuard], // Apply the AuthGuard here
  },
  { path: '**', redirectTo: '' },
];
