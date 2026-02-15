import { UserConfigController } from './user-config.controller';

describe('UserConfigController', () => {
  it('GET returns existing config when present', async () => {
    const db = {
      getByUserId: jest.fn().mockResolvedValue({ userId: 'u1', displayName: 'Wolf', dailyGoal: 10 }),
      upsert: jest.fn(),
    };

    const ctrl = new UserConfigController(db as any);
    await expect(ctrl.get('u1')).resolves.toEqual({ userId: 'u1', displayName: 'Wolf', dailyGoal: 10 });
  });

  it('GET returns default config when none exists', async () => {
    const db = {
      getByUserId: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    };

    const ctrl = new UserConfigController(db as any);
    await expect(ctrl.get('u1')).resolves.toEqual({
      userId: 'u1',
      displayName: '',
      dailyGoal: 100,
      ui: { showSourceColumn: false },
    });
  });

  it('PUT normalizes body and forwards only provided fields', async () => {
    const db = {
      getByUserId: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ userId: 'u1', displayName: 'Wolf', dailyGoal: 200 }),
    };

    const ctrl = new UserConfigController(db as any);

    const out = await ctrl.put('u1', {
      displayName: 'Wolf',
      dailyGoal: 200,
      ui: { showSourceColumn: true },
    });

    expect(db.upsert).toHaveBeenCalledWith('u1', {
      displayName: 'Wolf',
      dailyGoal: 200,
      ui: { showSourceColumn: true },
    });
    expect(out).toEqual({ userId: 'u1', displayName: 'Wolf', dailyGoal: 200 });
  });

  it('PUT ignores non-numeric dailyGoal and preserves empty patch', async () => {
    const db = {
      getByUserId: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ userId: 'u1' }),
    };

    const ctrl = new UserConfigController(db as any);

    await ctrl.put('u1', { dailyGoal: 'nope' as any });

    expect(db.upsert).toHaveBeenCalledWith('u1', {});
  });
});
