import { mainNavItems } from './main-nav-items';

describe('mainNavItems', () => {
  it('should keep the familiar order and add the rest behind it', () => {
    // when
    const paths = mainNavItems(true).map((item) => item.path);

    // then
    expect(paths).toEqual([
      '/app',
      '/analysis',
      '/leaderboard',
      '/freunde',
      '/training-plans',
      '/blog',
      '/history',
      '/wiki/uebungen',
      '/wiki/liegestuetz-typen',
    ]);
  });

  it('should leave friends out for guests', () => {
    // when / then — a friends list needs an account
    expect(mainNavItems(false).map((item) => item.path)).not.toContain(
      '/freunde'
    );
  });

  it('should put the request counter on the friends entry only', () => {
    // when
    const withBadge = mainNavItems(true).filter((i) => i.badge);

    // then
    expect(withBadge.map((i) => i.path)).toEqual(['/freunde']);
  });

  it('should match the dashboard exactly, everything else as a prefix', () => {
    // when / then — `/app` is a prefix of nothing, but `/blog` of every article
    expect(mainNavItems(true).find((i) => i.path === '/app')?.exact).toBe(true);
    expect(
      mainNavItems(true).find((i) => i.path === '/blog')?.exact
    ).toBeUndefined();
  });
});
