import { DATA_MIGRATIONS } from './migration-descriptors';

describe('DATA_MIGRATIONS', () => {
  it('should use unique ids so statuses never collide', () => {
    // given
    const ids = DATA_MIGRATIONS.map((m) => m.id);

    // then
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should wire the XP backfill to its callable', () => {
    // when
    const backfill = DATA_MIGRATIONS.find((m) => m.id === 'xp-backfill');

    // then
    expect(backfill?.migrate.callable).toBe('backfillXp');
    expect(backfill?.rollback).toBeUndefined();
  });

  it('should wire the training stats backfill to its callable', () => {
    // when
    const backfill = DATA_MIGRATIONS.find(
      (m) => m.id === 'training-stats-backfill'
    );

    // then
    expect(backfill?.migrate.callable).toBe('backfillTrainingStats');
    expect(backfill?.rollback).toBeUndefined();
  });
});
