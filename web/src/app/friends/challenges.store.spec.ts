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
  const zeroed = [
    {
      uid: 'friend',
      displayName: 'Ada',
      value: 0,
      isViewer: false,
      canCheer: false,
      cheered: false,
    },
    {
      uid: 'me',
      displayName: 'Wolf',
      value: 0,
      isViewer: true,
      canCheer: false,
      cheered: false,
    },
  ];
  const scored: ChallengeView = {
    ...active,
    entries: [
      {
        uid: 'friend',
        displayName: 'Ada',
        value: 300,
        isViewer: false,
        canCheer: false,
        cheered: false,
      },
      {
        uid: 'me',
        displayName: 'Wolf',
        value: 120,
        isViewer: true,
        canCheer: false,
        cheered: false,
      },
    ],
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

  it('should share one call between callers asking for the same thing at once', async () => {
    // given — the drawer's badge and the nav's copies all count on start-up
    const { store, api } = setup([invitation]);

    // when
    await Promise.all([
      store.reload({ progress: false }),
      store.reload({ progress: false }),
      store.reload({ progress: false }),
    ]);

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.invitations().map((c) => c.id)).toEqual(['c2']);
  });

  it('should not let a count-only call stand in for the full list', async () => {
    // given
    const { store, api } = setup();

    // when — the page asks for progress while the badge's count is in flight
    await Promise.all([store.reload({ progress: false }), store.reload()]);

    // then
    expect(api.list).toHaveBeenCalledTimes(2);
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

  it('should flag a failed reload and clear the flag on the next success', async () => {
    // given
    const { store, api } = setup([active]);
    api.list.mockRejectedValueOnce(new Error('offline'));

    // when
    await store.reload();

    // then — nothing pretends to be fresh
    expect(store.loadFailed()).toBe(true);

    // when
    await store.reload();

    // then
    expect(store.loadFailed()).toBe(false);
    expect(store.challenges().map((c) => c.id)).toEqual(['c1']);
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
  it('should keep the sums when a count-only reload follows a full one', async () => {
    // given — the page read the progress, then the nav badge counts
    const { store, api } = setup();
    api.list
      .mockResolvedValueOnce([scored])
      .mockResolvedValueOnce([{ ...scored, entries: zeroed }]);
    await store.reload();

    // when
    await store.reload({ progress: false });

    // then — the badge asked for counts, not for the board to be blanked
    expect(store.challenges()[0].entries.map((e) => e.value)).toEqual([
      300, 120,
    ]);
  });

  it('should let a count-only caller join a full call already in flight', async () => {
    // given — the friends page is loading when the badge mounts
    const { store, api } = setup([scored]);

    // when
    await Promise.all([store.reload(), store.reload({ progress: false })]);

    // then — one call, and its sums survive: a second ticket would have
    // dropped the full answer unread and shown everyone at 0
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.challenges()[0].entries.map((e) => e.value)).toEqual([
      300, 120,
    ]);
  });
  it('should keep the answered challenge busy until the re-read lands', async () => {
    // given — an answer the server has not confirmed yet
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { store, api } = setup([invitation]);
    api.respond.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    const done = store.accept('c2');

    // then — only this card's accept button is busy
    expect(store.isBusy('accept:c2')).toBe(true);
    expect(store.busyKeys().has('accept:c2')).toBe(true);
    expect(store.isBusy('decline:c2')).toBe(false);
    expect(store.isBusy('leave:c2')).toBe(false);

    // when — confirmed, then the list is re-read
    answer({ ok: true });
    await done;

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.isBusy('accept:c2')).toBe(false);
  });

  it('should mark a create busy until it settles, even when refused', async () => {
    // given
    const { store, api } = setup();
    api.create.mockResolvedValue({ ok: false, reason: 'ended' });
    const input = {
      friendUids: ['b'],
      exerciseId: 'pushup',
      exerciseName: 'Liegestütze',
      target: 500,
      days: 7 as const,
    };

    // when
    const done = store.create(input);

    // then
    expect(store.isBusy('create')).toBe(true);

    // when
    await done;

    // then
    expect(store.isBusy('create')).toBe(false);
    expect(store.lastRejection()).toBe('ended');
  });
});
