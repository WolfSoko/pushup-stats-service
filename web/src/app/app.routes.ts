import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  LoginComponent,
  publicOnlyGuard,
  RegisterComponent,
} from '@pu-auth/auth';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      seoTitle: $localize`:@@seo.landing.title:Pushup Tracker – Dein Training. Klar visualisiert.`,
      seoDescription: $localize`:@@seo.landing.description:Tracke Reps, Trends und Streaks in Sekunden – mobil, schnell und mit Live-Updates.`,
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
      seoTitle: $localize`:@@seo.dashboard.title:Dashboard – Pushup Tracker`,
      seoDescription: $localize`:@@seo.dashboard.description:Behalte Trainingsvolumen und Verlauf im Blick – klar, schnell und mobil optimiert.`,
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
      seoTitle: $localize`:@@seo.login.title:Login – Pushup Tracker`,
      seoDescription: $localize`:@@seo.login.description:Melde dich an und tracke dein Pushup-Training über alle Geräte.`,
    },
    component: LoginComponent,
  },
  {
    path: 'register',
    canActivate: [publicOnlyGuard],
    data: {
      seoTitle: $localize`:@@seo.register.title:Registrierung – Pushup Tracker`,
      seoDescription: $localize`:@@seo.register.description:Erstelle dein Konto und richte Profil, Tagesziel und Einwilligungen ein.`,
    },
    component: RegisterComponent,
  },
  {
    path: 'data',
    canActivate: [authGuard],
    data: {
      seoTitle: $localize`:@@seo.data.title:Daten – Pushup Tracker`,
      seoDescription: $localize`:@@seo.data.description:Verwalte Einträge, filtere nach Zeitraum und behalte deine Trainingsdaten im Griff.`,
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
      seoTitle: $localize`:@@seo.analysis.title:Analyse – Pushup Tracker`,
      seoDescription: $localize`:@@seo.analysis.description:Analysiere Trends, Verteilungen und Streaks deines Trainings.`,
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
      seoTitle: $localize`:@@seo.settings.title:Einstellungen – Pushup Tracker`,
      seoDescription: $localize`:@@seo.settings.description:Verwalte Profil, Leaderboard-Sichtbarkeit und Tagesziel-Einstellungen.`,
    },
    loadComponent: () =>
      import('./stats/shell/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
  },
  {
    path: 'reminders',
    canActivate: [authGuard],
    data: {
      seoTitle: $localize`:@@seo.reminders.title:Erinnerungen – Pushup Tracker`,
      seoDescription: $localize`:@@seo.reminders.description:Konfiguriere Liegestütz-Erinnerungen und Push-Benachrichtigungen.`,
    },
    loadComponent: () =>
      import('./reminders/shell/reminders-page.component').then(
        (m) => m.RemindersPageComponent
      ),
  },
  {
    path: 'leaderboard',
    data: {
      seoTitle: $localize`:@@seo.leaderboard.title:Bestenliste – Pushup Tracker`,
      seoDescription: $localize`:@@seo.leaderboard.description:Öffentliche Bestenliste für tägliche, wöchentliche und monatliche Pushup-Reps.`,
    },
    loadComponent: () =>
      import('./leaderboard/shell/leaderboard-page.component').then(
        (m) => m.LeaderboardPageComponent
      ),
  },
  {
    path: 'blog',
    children: [
      {
        path: '',
        pathMatch: 'full',
        data: {
          seoTitle: $localize`:@@seo.blog.title:Blog – Liegestütze Tipps & Guides | Pushup Tracker`,
          seoDescription: $localize`:@@seo.blog.description:Tipps, Trainingspläne und Motivation rund um Liegestütze – von Einsteiger bis Fortgeschritten.`,
        },
        loadComponent: () =>
          import('./blog/blog-list.component').then((m) => m.BlogListComponent),
      },
      {
        path: ':slug',
        loadComponent: () =>
          import('./blog/blog-article.component').then(
            (m) => m.BlogArticleComponent
          ),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/admin-page.component').then((m) => m.AdminPageComponent),
  },
  { path: '**', redirectTo: '' },
];
