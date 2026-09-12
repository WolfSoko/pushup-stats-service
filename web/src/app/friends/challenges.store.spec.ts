import { TestBed } from '@angular/core/testing';

import {
  ChallengesApiService,
  type ChallengeView,
} from './challenges-api.service';
import { ChallengesStore } from './challenges.store';

describe('ChallengesStore', () => {
  const active: ChallengeView = {
    id: 'c1',
    createdBy: 'me',
    exerciseId: 'pushup',
    target: 500,
    from: '2026-09-14',
    to: '2026-09-20',
    status: 'active',
    entries: [],
  };
  const ended: ChallengeView = { ...active, id: 'c0', status: 'ended' };

  function setup(challenges: ChallengeView[] = []) {
    const api = {
      list: vitest.fn().mockResolvedValue(challenges),
      create: vitest.fn().mockResolvedValue({ ok: true }),
      leave: vitest.fn().mockResolvedValue({ ok: true }),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ChallengesApiService, useValue: api }],
    });
    return { store: TestBed.inject(ChallengesStore), api };
  }

  it('should split running and finished challenges', async () => {
    // given
    const { store } = setup([active, ended]);

    // when
    await store.reload();

    // then
    expect(store.active().map((c) => c.id)).toEqual(['c1']);
    expect(store.ended().map((c) => c.id)).toEqual(['c0']);
  });

  it('should re-read after creating one', async () => {
    // given
    const { store, api } = setup();
    const input = {
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7 as const,
    };

    // when
    const ok = await store.create(input);

    // then
    expect(ok).toBe(true);
    expect(api.create).toHaveBeenCalledWith(input);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('should keep the refusal reason and not reload', async () => {
    // given
    const { store, api } = setup();
    api.create.mockResolvedValue({ ok: false, reason: 'limit' });

    // when
    const ok = await store.create({
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7,
    });

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('limit');
    expect(api.list).not.toHaveBeenCalled();
  });

  it('should report a thrown call as a failure', async () => {
    // given
    const { store, api } = setup();
    api.leave.mockRejectedValue(new Error('offline'));

    // when
    const ok = await store.leave('c1');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('failed');
  });

  it('should keep what it had when a reload fails', async () => {
    // given
    const { store, api } = setup([active]);
    await store.reload();
    api.list.mockRejectedValue(new Error('offline'));

    // when
    await store.reload();

    // then
    expect(store.challenges()).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });
});
