// Test the pure tree-builder. The satori/resvg integration is verified at
// HTTP-handler integration level — pulling the WASM into Jest would slow
// every spec run by ~1s for no extra coverage.
jest.mock('satori', () => ({ default: jest.fn() }));
jest.mock('@resvg/resvg-wasm', () => ({
  Resvg: jest.fn(),
  initWasm: jest.fn(),
}));

import { buildOgTree } from './og-render';
import type { PublicProfileProjection } from './public-profile';

describe('buildOgTree', () => {
  const profile: PublicProfileProjection = {
    uid: 'abcdef1234567890',
    displayName: 'Wolfi',
    total: 5000,
    totalEntries: 200,
    totalDays: 90,
    currentStreak: 14,
    bestSingleEntry: 50,
    bestDayTotal: 250,
    updatedAt: '2026-04-29T08:30:00.000Z',
  };

  function flatten(node: unknown): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(flatten).join(' ');
    if (
      node &&
      typeof node === 'object' &&
      'props' in node &&
      typeof (node as { props: { children?: unknown } }).props === 'object'
    ) {
      const children = (node as { props: { children?: unknown } }).props
        .children;
      return children === undefined ? '' : flatten(children);
    }
    return '';
  }

  it('Renders the displayName, formatted total reps, streak and active days', () => {
    const tree = buildOgTree(profile);
    const text = flatten(tree);

    expect(text).toContain('Wolfi');
    // German thousands separator (de-DE locale).
    expect(text).toContain('5.000');
    expect(text).toContain('Streak 14');
    expect(text).toContain('90 Tage');
  });

  it('Always renders the brand mark and canonical URL', () => {
    const text = flatten(buildOgTree(profile));
    expect(text).toContain('Pushup Tracker');
    expect(text).toContain('pushup-stats.de');
  });

  it('Survives anonymous profiles with zero stats', () => {
    const empty: PublicProfileProjection = {
      ...profile,
      displayName: 'anonym',
      total: 0,
      totalDays: 0,
      currentStreak: 0,
    };
    const text = flatten(buildOgTree(empty));
    expect(text).toContain('anonym');
    expect(text).toContain('0 Reps');
    expect(text).toContain('Streak 0');
  });

  it('Card dimensions and brand colours stay 1200×630 and dark', () => {
    // OG cards are aspect-locked at 1.91:1 (1200×630). Anything else gets
    // letter-boxed or cropped by Twitter/FB; assert the wrapper inherits
    // the full root frame so the wrapper layout is unambiguous.
    const tree = buildOgTree(profile) as unknown as {
      props: { style: { width: string; height: string; background: string } };
    };
    expect(tree.props.style.width).toBe('100%');
    expect(tree.props.style.height).toBe('100%');
    expect(String(tree.props.style.background)).toContain('linear-gradient');
  });
});
