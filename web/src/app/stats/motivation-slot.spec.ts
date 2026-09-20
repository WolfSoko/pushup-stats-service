import type { InboxRow } from '../notifications/inbox-rows';
import {
  MOTIVATION_SLOT_MAX_AGE_MS,
  pickMotivationSlot,
} from './motivation-slot';

const NOW = Date.parse('2026-09-20T12:00:00.000Z');

function row(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    id: 'n1',
    kind: 'notification',
    category: 'motivation',
    icon: 'local_fire_department',
    text: 'Anna feuert dich an',
    createdAt: new Date(NOW - 60_000).toISOString(),
    unread: true,
    url: '/freunde',
    ...overrides,
  };
}

describe('pickMotivationSlot', () => {
  it('should prefer a fresh cheer over the generated quote', () => {
    // when
    const slot = pickMotivationSlot([row()], 'Bleib dran!', NOW);

    // then
    expect(slot).toEqual({
      icon: 'local_fire_department',
      text: 'Anna feuert dich an',
      personal: true,
    });
  });

  it('should fall back to the quote when there is no cheer', () => {
    // when
    const slot = pickMotivationSlot([], 'Bleib dran!', NOW);

    // then
    expect(slot).toEqual({
      icon: 'auto_awesome',
      text: 'Bleib dran!',
      personal: false,
    });
  });

  it('should ignore a cheer the user has already read', () => {
    // when
    const slot = pickMotivationSlot(
      [row({ unread: false })],
      'Bleib dran!',
      NOW
    );

    // then
    expect(slot?.personal).toBe(false);
  });

  it('should ignore a cheer older than the cutoff, which is no longer news', () => {
    // given
    const stale = new Date(
      NOW - MOTIVATION_SLOT_MAX_AGE_MS - 1000
    ).toISOString();

    // when
    const slot = pickMotivationSlot([row({ createdAt: stale })], 'Q', NOW);

    // then
    expect(slot?.personal).toBe(false);
  });

  it('should ignore a social row, which belongs in the inbox and not here', () => {
    // when
    const slot = pickMotivationSlot(
      [row({ category: 'social', text: 'Ben möchte befreundet sein' })],
      'Q',
      NOW
    );

    // then
    expect(slot?.text).toBe('Q');
  });

  it('should ignore an announcement, which has no timestamp', () => {
    // when
    const slot = pickMotivationSlot(
      [row({ category: 'system', kind: 'announcement', createdAt: null })],
      'Q',
      NOW
    );

    // then
    expect(slot?.personal).toBe(false);
  });

  it('should render nothing when there is neither a cheer nor a quote', () => {
    // then
    expect(pickMotivationSlot([], null, NOW)).toBeNull();
  });
});
