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
    invited: [],
    viewerInvited: false,
  };
  const ended: ChallengeView = { ...active, id: 'c0', status: 'ended' };
  const invitation: ChallengeView = {
    ...active,
    id: 'c2',
    viewerInvited: true,
  };

  function setup(challenges: ChallengeView[] = []) {
    const api = {
      list: vitest.fn().mockResolvedValue(challenges),
      create: vitest.fn().mockResolvedValue({ ok: true }),
      respond: vitest.fn().mockResolvedValue({ ok: true }),
      leave: vitest.fn().mockResolvedValue({ ok: true }),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ChallengesApiService, useValue: api }],
    });
    return { store: TestBed.inject(ChallengesStore), api };
  }

  it('should split invitations, running and finished challenges', async () => {
    // given
    const { store } = setup([active, ended, invitation]);

    // when
    await store.reload();

    // then — an invitation is not "running" for the viewer yet
    expect(store.invitations().map((c) => c.id)).toEqual(['c2']);
    expect(store.active().map((c) => c.id)).toEqual(['c1']);
    expect(store.ended().map((c) => c.id)).toEqual(['c0']);
  });

  it('should keep the newest reload’s answer when an older one arrives late', async () => {
    // given — the dashboard's count-only call is still in flight when the
    // friends page asks for the full list
    const { store, api } = setup();
    let resolveSlow: (value: ChallengeView[]) => void = () => undefined;
    api.list
      .mockReturnValueOnce(
        new Promise<ChallengeView[]>((resolve) => (resolveSlow = resolve))
      )
      .mockResolvedValueOnce([active, invitation]);

    // when
    const slow = store.reload({ progress: false });
    await store.reload();
    resolveSlow([{ ...active, entries: [] }]);
    await slow;

    // then — the full list stands, the stale count-only reply is dropped
    expect(store.challenges().map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(store.loading()).toBe(false);
  });

  it('should pass the progress flag through', async () => {
    // given
    const { store, api } = setup();

    // when
    await store.reload({ progress: false });

    // then
    expect(api.list).toHaveBeenCalledWith({ progress: false });
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

  it('should answer an invitation with the same call either way', async () => {
    // given
    const { store, api } = setup();

    // when
    await store.accept('c2');
    await store.decline('c2');

    // then
    expect(api.respond).toHaveBeenNthCalledWith(1, 'c2', true);
    expect(api.respond).toHaveBeenNthCalledWith(2, 'c2', false);
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
