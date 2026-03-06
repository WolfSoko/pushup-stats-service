import { Routes } from '@angular/router';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { authGuard, publicOnlyGuard } from '@pu-auth/auth';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      seoTitle: 'Pushup Tracker – Dein Training. Klar visualisiert.',
      seoDescription:
        'Tracke Reps, Trends und Streaks in Sekunden – mobil, schnell und mit Live-Updates.',
    },
    loadComponent: () =>
      import('./marketing/shell/landing-page.component').then(
        (m) => m.LandingPageComponent
      ),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    data: {
      seoTitle: 'Dashboard – Pushup Tracker',
      seoDescription:
        'Behalte Trainingsvolumen und Verlauf im Blick – klar, schnell und mobil optimiert.',
    },
    loadComponent: () =>
      import('./stats/shell/stats-dashboard.component').then(
        (m) => m.StatsDashboardComponent
      ),
  },
  {
    path: 'landing',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    data: {
      seoTitle: 'Login – Pushup Tracker',
      seoDescription:
        'Melde dich an und tracke dein Pushup-Training über alle Geräte.',
    },
    loadComponent: () => import('@pu-auth/auth').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [publicOnlyGuard],
    data: {
      seoTitle: 'Registrierung – Pushup Tracker',
      seoDescription:
        'Erstelle dein Konto und richte Profil, Tagesziel und Einwilligungen ein.',
    },
    loadComponent: () => import('@pu-auth/auth').then((m) => m.LoginComponent),
  },
  {
    path: 'data',
    canActivate: [authGuard],
    data: {
      seoTitle: 'Daten – Pushup Tracker',
      seoDescription:
        'Verwalte Einträge, filtere nach Zeitraum und behalte deine Trainingsdaten im Griff.',
    },
    loadComponent: () =>
      import('./stats/shell/entries-page.component').then(
        (m) => m.EntriesPageComponent
      ),
  },
  {
    path: 'analysis',
    canActivate: [authGuard],
    data: {
      seoTitle: 'Analyse – Pushup Tracker',
      seoDescription:
        'Analysiere Trends, Verteilungen und Streaks deines Trainings.',
    },
    loadComponent: () =>
      import('./stats/shell/analysis-page.component').then(
        (m) => m.AnalysisPageComponent
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    data: {
      seoTitle: 'Einstellungen – Pushup Tracker',
      seoDescription:
        'Verwalte Profil, Leaderboard-Sichtbarkeit und Tagesziel-Einstellungen.',
    },
    loadComponent: () =>
      import('./stats/shell/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
  },
  {
    path: 'leaderboard',
    data: {
      seoTitle: 'Bestenliste – Pushup Tracker',
      seoDescription:
        'Öffentliche Bestenliste für tägliche, wöchentliche und monatliche Pushup-Reps.',
    },
    loadComponent: () =>
      import('./leaderboard/shell/leaderboard-page.component').then(
        (m) => m.LeaderboardPageComponent
      ),
  },
  { path: '**', redirectTo: '' },
];
