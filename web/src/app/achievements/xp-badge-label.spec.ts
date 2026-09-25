import { findAchievementDefinition } from '@pu-stats/models';
import { xpBadgeLabel } from './xp-badge-label';

function definition(id: string) {
  const found = findAchievementDefinition(id);
  if (!found) throw new Error(`unknown badge ${id}`);
  return found;
}

describe('xpBadgeLabel', () => {
  it('should label level and variety badges', () => {
    // then
    expect(xpBadgeLabel(definition('level-10'))).toBe('Level 10 erreicht');
    expect(xpBadgeLabel(definition('variety-5'))).toBe(
      'Vielseitig: 5 Kategorien'
    );
  });

  it('should leave other kinds to their own label', () => {
    // then
    expect(xpBadgeLabel(definition('plan-days-10'))).toBeNull();
  });
});
