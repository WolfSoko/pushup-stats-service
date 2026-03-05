import { Routes } from '@angular/router';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { authGuard, publicOnlyGuard } from '@pu-auth/auth';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./stats/shell/stats-dashboard.component').then(
        (m) => m.StatsDashboardComponent
      ),
  },
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('@pu-auth/auth').then((m) => m.LoginComponent),
  },
  {
    path: 'data',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./stats/shell/entries-page.component').then(
        (m) => m.EntriesPageComponent
      ),
  },
  {
    path: 'analysis',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./stats/shell/analysis-page.component').then(
        (m) => m.AnalysisPageComponent
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./stats/shell/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
