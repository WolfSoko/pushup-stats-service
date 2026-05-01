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
      seoTitle: $localize`:@@seo.landing.title:Liegestütze Tracker – Reps, Streaks und Fortschritt im Blick`,
      seoDescription: $localize`:@@seo.landing.description:Liegestütze tracken mit einer kostenlosen Web-App. Tagesziel, Streaks, Bestleistungen – mobil, schnell und mit Live-Updates.`,
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
    path: 'history',
    canActivate: [authGuard],
    data: {
      seoTitle: $localize`:@@seo.history.title:Historie – Pushup Tracker`,
      seoDescription: $localize`:@@seo.history.description:Durchsuche deine Trainingshistorie, filtere nach Zeitraum und behalte den Überblick.`,
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
    path: 'training-plans',
    data: {
      seoTitle: $localize`:@@seo.trainingPlans.title:Trainingspläne – Pushup Tracker`,
      seoDescription: $localize`:@@seo.trainingPlans.description:Strukturierte Liegestütz-Trainingspläne mit Tagesziel, Sätzen und automatischer Fortschrittsverfolgung.`,
    },
    loadComponent: () =>
      import('./training-plans/training-plans-page.component').then(
        (m) => m.TrainingPlansPageComponent
      ),
  },
  {
    path: 'training-plans/:slug',
    loadComponent: () =>
      import('./training-plans/training-plan-detail.component').then(
        (m) => m.TrainingPlanDetailComponent
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
      seoDescription: $localize`:@@seo.leaderboard.description:Öffentliche Bestenliste mit Top-Reps für heute, die letzten 7 Tage und die letzten 30 Tage.`,
    },
    loadComponent: () =>
      import('./leaderboard/shell/leaderboard-page.component').then(
        (m) => m.LeaderboardPageComponent
      ),
  },
  {
    path: 'u/:uid',
    data: {
      seoTitle: $localize`:@@seo.publicProfile.title:Profil – Pushup Tracker`,
      seoDescription: $localize`:@@seo.publicProfile.description:Öffentliches Pushup-Profil mit Reps, Streak und Bestleistungen.`,
    },
    loadComponent: () =>
      import('./public-profile/public-profile-page.component').then(
        (m) => m.PublicProfilePageComponent
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
    path: 'impressum',
    data: {
      seoTitle: $localize`:@@seo.impressum.title:Impressum – Pushup Tracker`,
      seoDescription: $localize`:@@seo.impressum.description:Impressum und Anbieterkennzeichnung von Pushup Tracker.`,
    },
    loadComponent: () =>
      import('./marketing/legal/impressum-page.component').then(
        (m) => m.ImpressumPageComponent
      ),
  },
  {
    path: 'datenschutz',
    data: {
      seoTitle: $localize`:@@seo.datenschutz.title:Datenschutzerklärung – Pushup Tracker`,
      seoDescription: $localize`:@@seo.datenschutz.description:Datenschutzerklärung von Pushup Tracker – Informationen zu Datenverarbeitung, Cookies und Ihren Rechten.`,
    },
    loadComponent: () =>
      import('./marketing/legal/datenschutz-page.component').then(
        (m) => m.DatenschutzPageComponent
      ),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./admin/admin-page.component').then((m) => m.AdminPageComponent),
  },
  { path: '**', redirectTo: '' },
];
