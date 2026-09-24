import { findAchievementDefinition } from './achievement.models';
import {
  deriveXpAchievements,
  levelAchievementId,
  varietyAchievementId,
  xpCategoryCount,
} from './xp-achievement.models';

describe('deriveXpAchievements', () => {
  it('should award every level milestone at or below the level', () => {
    // when
    const ids = deriveXpAchievements({ level: 12, byExercise: {} });

    // then
    expect(ids).toEqual(['level-5', 'level-10']);
  });

  it('should award variety badges by distinct categories, not exercises', () => {
    // given — situps and plank share the core category
    const byExercise = {
      'abs.situps': 10,
      'plank.standard': 5,
      pushup: 3,
      'pull.pullups': 9,
    };

    // when
    const ids = deriveXpAchievements({ level: 1, byExercise });

    // then
    expect(ids).toEqual(['variety-3']);
  });

  it('should not count categories without XP or unknown exercises', () => {
    // then
    expect(xpCategoryCount({ pushup: 0, 'abs.situps': 4, gone: 50 })).toBe(1);
  });
});

describe('findAchievementDefinition for XP badges', () => {
  it('should resolve level and variety badges', () => {
    // then
    expect(findAchievementDefinition(levelAchievementId(20))).toEqual(
      expect.objectContaining({ kind: 'level', threshold: 20 })
    );
    expect(findAchievementDefinition(varietyAchievementId(5))).toEqual(
      expect.objectContaining({ kind: 'variety', threshold: 5 })
    );
  });

  it('should return null for a level without a badge', () => {
    // then
    expect(findAchievementDefinition('level-7')).toBeNull();
  });
});
