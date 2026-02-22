// eslint-disable-next-line @nx/enforce-module-boundaries
import { LoginComponent } from '@pu-auth/auth';
import { appRoutes } from './app.routes';
import { AnalysisPageComponent } from './stats/shell/analysis-page.component';
import { EntriesPageComponent } from './stats/shell/entries-page.component';
import { SettingsPageComponent } from './stats/shell/settings-page.component';
import { StatsDashboardComponent } from './stats/shell/stats-dashboard.component';

describe('appRoutes', () => {
  it('defines dashboard, data and analysis routes', () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toEqual(['', 'login', 'data', 'analysis', 'settings', '**']);
  });

  it('lazy-loads dashboard component', async () => {
    const route = appRoutes.find((r) => r.path === '');
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

  it('lazy-routes login component', async () => {
    const route = appRoutes.find((r) => r.path === 'login');
    const component = await route?.loadComponent?.();
    expect(component).toBe(LoginComponent);
  });

  it('redirects wildcard route to dashboard', () => {
    const wildcard = appRoutes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });
});
