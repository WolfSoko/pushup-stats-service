import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('defines dashboard, data and analysis routes', () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toEqual(['', 'daten', 'eintraege', 'analyse', 'settings', '**']);
  });

  it('lazy-loads dashboard component', async () => {
    const route = appRoutes.find((r) => r.path === '');
    const component = await route?.loadComponent?.();
    expect((component as { name?: string })?.name).toBe('StatsDashboardComponent');
  });

  it('lazy-loads data component on /daten', async () => {
    const route = appRoutes.find((r) => r.path === 'daten');
    const component = await route?.loadComponent?.();
    expect((component as { name?: string })?.name).toBe('EntriesPageComponent');
  });

  it('redirects /eintraege to /daten', () => {
    const route = appRoutes.find((r) => r.path === 'eintraege');
    expect(route?.redirectTo).toBe('daten');
  });

  it('lazy-loads analysis component', async () => {
    const route = appRoutes.find((r) => r.path === 'analyse');
    const component = await route?.loadComponent?.();
    expect((component as { name?: string })?.name).toBe('AnalysisPageComponent');
  });

  it('redirects wildcard route to dashboard', () => {
    const wildcard = appRoutes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });
});
