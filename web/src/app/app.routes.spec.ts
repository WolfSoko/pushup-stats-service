import {
  authGuard,
  LoginComponent,
  publicOnlyGuard,
  RegisterComponent,
} from '@pu-auth/auth';
import { appRoutes } from './app.routes';
import { LandingPageComponent } from './marketing/shell/landing-page.component';
import { AnalysisPageComponent } from './stats/shell/analysis-page.component';
import { EntriesPageComponent } from './stats/shell/entries-page.component';
import { SettingsPageComponent } from './stats/shell/settings-page.component';
import { StatsDashboardComponent } from './stats/shell/stats-dashboard.component';
import { LeaderboardPageComponent } from './leaderboard/shell/leaderboard-page.component';

describe('appRoutes', () => {
  it('defines landing, app and feature routes', () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toEqual([
      '',
      'app',
      'landing',
      'login',
      'register',
      'data',
      'analysis',
      'settings',
      'reminders',
      'leaderboard',
      'blog',
      'admin',
      '**',
    ]);
  });

  it('lazy-loads landing component on /', async () => {
    const route = appRoutes.find((r) => r.path === '');
    const component = await route?.loadComponent?.();
    expect(component).toBe(LandingPageComponent);
  });

  it('lazy-loads dashboard component on /app', async () => {
    const route = appRoutes.find((r) => r.path === 'app');
    const component = await route?.loadComponent?.();
    expect(component).toBe(StatsDashboardComponent);
  });

  it('lazy-loads data component on /data', async () => {
    const route = appRoutes.find((r) => r.path === 'data');
    const component = await route?.loadComponent?.();
    expect(component).toBe(EntriesPageComponent);
  });

  it('lazy-loads analysis component', async () => {
    const route = appRoutes.find((r) => r.path === 'analysis');
    const component = await route?.loadComponent?.();
    expect(component).toBe(AnalysisPageComponent);
  });

  it('lazy-loads settings component', async () => {
    const route = appRoutes.find((r) => r.path === 'settings');
    const component = await route?.loadComponent?.();
    expect(component).toBe(SettingsPageComponent);
  });

  it('lazy-loads public leaderboard component', async () => {
    const route = appRoutes.find((r) => r.path === 'leaderboard');
    const component = await route?.loadComponent?.();
    expect(component).toBe(LeaderboardPageComponent);
  });

  it('statically loads login component', () => {
    const route = appRoutes.find((r) => r.path === 'login');
    expect(route?.component).toBe(LoginComponent);
  });

  it('statically loads register component', () => {
    const route = appRoutes.find((r) => r.path === 'register');
    expect(route?.component).toBe(RegisterComponent);
  });

  it('adds seo metadata to primary routes', () => {
    const landing = appRoutes.find((r) => r.path === '');
    const app = appRoutes.find((r) => r.path === 'app');
    const settings = appRoutes.find((r) => r.path === 'settings');

    expect(landing?.data?.['seoTitle']).toContain('Pushup Tracker');
    expect(app?.data?.['seoDescription']).toBeTruthy();
    expect(settings?.data?.['seoDescription']).toContain('Tagesziel');
  });

  it('protects app routes and keeps landing/login/register public-only', () => {
    const protectedPaths = ['app', 'data', 'analysis', 'settings'];
    for (const path of protectedPaths) {
      const route = appRoutes.find((r) => r.path === path);
      expect(route?.canActivate).toEqual([authGuard]);
    }

    const rootRoute = appRoutes.find((r) => r.path === '');
    expect(rootRoute?.canActivate).toBeUndefined();

    const loginRoute = appRoutes.find((r) => r.path === 'login');
    expect(loginRoute?.canActivate).toEqual([publicOnlyGuard]);

    const registerRoute = appRoutes.find((r) => r.path === 'register');
    expect(registerRoute?.canActivate).toEqual([publicOnlyGuard]);
  });

  it('redirects legacy /landing and wildcard to /', () => {
    const legacyLanding = appRoutes.find((r) => r.path === 'landing');
    expect(legacyLanding?.redirectTo).toBe('');

    const wildcard = appRoutes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });
});
