import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('defines dashboard, entries and analysis routes', () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toEqual(['', 'eintraege', 'analyse', '**']);
  });

  it('lazy-loads dashboard component', async () => {
    const route = appRoutes.find((r) => r.path === '');
    const component = await route?.loadComponent?.();
    expect((component as { name?: string })?.name).toBe('StatsDashboardComponent');
  });

  it('lazy-loads entries component', async () => {
    const route = appRoutes.find((r) => r.path === 'eintraege');
    const component = await route?.loadComponent?.();
    expect((component as { name?: string })?.name).toBe('EntriesPageComponent');
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
