import { TestBed } from '@angular/core/testing';

import { FriendsApiService, type FriendRow } from './friends-api.service';
import { FriendsStore } from './friends.store';

describe('FriendsStore', () => {
  const friend: FriendRow = {
    id: 'a__b',
    uid: 'b',
    since: '2026-09-01T10:00:00.000Z',
    displayName: 'Wolf',
    photoURL: null,
  };

  function setup(
    lists: Partial<{
      friends: FriendRow[];
      incoming: FriendRow[];
      outgoing: FriendRow[];
    }> = {}
  ) {
    const api = {
      list: vitest.fn().mockResolvedValue({
        friends: lists.friends ?? [],
        incoming: lists.incoming ?? [],
        outgoing: lists.outgoing ?? [],
      }),
      request: vitest.fn().mockResolvedValue({ ok: true }),
      respond: vitest.fn().mockResolvedValue({ ok: true }),
      remove: vitest.fn().mockResolvedValue({ ok: true }),
      board: vitest.fn().mockResolvedValue([]),
      cheer: vitest.fn().mockResolvedValue({ ok: true }),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: FriendsApiService, useValue: api }],
    });
    return { store: TestBed.inject(FriendsStore), api };
  }

  it('should load the three lists', async () => {
    // given
    const { store } = setup({ friends: [friend], incoming: [friend] });

    // when
    await store.reload();

    // then
    expect(store.friendCount()).toBe(1);
    expect(store.pendingCount()).toBe(1);
    expect(store.isEmpty()).toBe(false);
  });

  it('should re-read the lists after answering a request', async () => {
    // given — the other side may have acted in the meantime, so the
    // server's version wins over a local patch
    const { store, api } = setup({ incoming: [friend] });
    await store.reload();
    api.list.mockClear();

    // when
    await store.accept('a__b');

    // then
    expect(api.respond).toHaveBeenCalledWith('a__b', true);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('should decline with the same call and the opposite answer', async () => {
    // given
    const { store, api } = setup({ incoming: [friend] });

    // when
    await store.decline('a__b');

    // then
    expect(api.respond).toHaveBeenCalledWith('a__b', false);
  });

  it('should keep the refusal reason for the page to explain', async () => {
    // given
    const { store, api } = setup();
    api.request.mockResolvedValue({ ok: false, reason: 'declined' });

    // when
    const ok = await store.requestFriend('b');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('declined');
  });

  it('should not reload after a refused action', async () => {
    // given
    const { store, api } = setup();
    api.remove.mockResolvedValue({ ok: false, reason: 'not-found' });

    // when
    await store.remove('a__b');

    // then — nothing changed server-side, so nothing to re-read
    expect(api.list).not.toHaveBeenCalled();
  });

  it('should survive a failing call without emptying the screen', async () => {
    // given
    const { store, api } = setup({ friends: [friend] });
    await store.reload();
    api.list.mockRejectedValue(new Error('offline'));

    // when
    await store.reload();

    // then
    expect(store.friendCount()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('should report a thrown action as a failure', async () => {
    // given
    const { store, api } = setup();
    api.request.mockRejectedValue(new Error('offline'));

    // when
    const ok = await store.requestFriend('b');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('failed');
  });

  it('should remember the period the board was asked for', async () => {
    // given
    const { store, api } = setup();

    // when
    await store.loadBoard('allTime');

    // then
    expect(api.board).toHaveBeenCalledWith('allTime', { metric: 'days' });
    expect(store.boardPeriod()).toBe('allTime');
  });

  it('should share one reload between consumers mounting at once', async () => {
    // given — the nav badge and the dashboard card both ask on init
    const { store, api } = setup({ friends: [friend] });

    // when
    await Promise.all([store.reload(), store.reload()]);

    // then
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(store.friendCount()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('should leave the remembered period alone for a preview', async () => {
    // given — the user picked a month on the friends page
    const { store, api } = setup();
    await store.loadBoard('month');

    // when — the dashboard card previews the week
    await store.loadBoard('week', { remember: false });

    // then
    expect(api.board).toHaveBeenLastCalledWith('week', { metric: 'days' });
    expect(store.boardPeriod()).toBe('month');
  });

  it('should re-read the board with the comparison the user picked', async () => {
    // given
    const { store, api } = setup();
    await store.loadBoard('month');

    // when — racing on pull-ups instead of counting days
    await store.compareBy({ metric: 'reps', exerciseId: 'pullup' });

    // then
    expect(api.board).toHaveBeenLastCalledWith('month', {
      metric: 'reps',
      exerciseId: 'pullup',
    });
    expect(store.boardComparison()).toEqual({
      metric: 'reps',
      exerciseId: 'pullup',
    });
  });

  it('should reuse the last period when none is given', async () => {
    // given
    const { store, api } = setup();
    await store.loadBoard('month');
    api.board.mockClear();

    // when
    await store.loadBoard();

    // then
    expect(api.board).toHaveBeenCalledWith('month', { metric: 'days' });
  });

  it('should re-read the board, not the lists, after a cheer', async () => {
    // given
    const { store, api } = setup();
    await store.loadBoard('daily');
    api.board.mockClear();

    // when
    const ok = await store.cheer('b');

    // then
    expect(ok).toBe(true);
    expect(api.cheer).toHaveBeenCalledWith('b');
    expect(api.board).toHaveBeenCalledWith('daily', { metric: 'days' });
    expect(api.list).not.toHaveBeenCalled();
  });

  it('should keep the tapped friend busy until the board is re-read', async () => {
    // given — a send the server has not answered yet
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { store, api } = setup();
    api.cheer.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    const done = store.cheer('b');

    // then — only Bob's flame is busy
    expect(store.isBusy('cheer:b')).toBe(true);
    expect(store.busyKeys().has('cheer:b')).toBe(true);
    expect(store.isBusy('cheer:c')).toBe(false);

    // when — the server answers and the board is re-read
    answer({ ok: true });
    await done;

    // then
    expect(api.board).toHaveBeenCalledTimes(1);
    expect(store.isBusy('cheer:b')).toBe(false);
  });

  it('should keep the answered request busy until the lists are re-read', async () => {
    // given
    let answer: (result: { ok: boolean }) => void = () => undefined;
    const { store, api } = setup({ incoming: [friend] });
    api.respond.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );

    // when
    const done = store.accept('a__b');

    // then — accept is busy, decline of the same row is not
    expect(store.isBusy('accept:a__b')).toBe(true);
    expect(store.isBusy('decline:a__b')).toBe(false);

    // when
    answer({ ok: true });
    await done;

    // then
    expect(store.isBusy('accept:a__b')).toBe(false);
  });

  it('should clear the busy flag when the action fails', async () => {
    // given
    const { store, api } = setup({ friends: [friend] });
    api.remove.mockRejectedValue(new Error('offline'));

    // when
    await store.remove('a__b');

    // then
    expect(store.lastRejection()).toBe('failed');
    expect(store.isBusy('remove:a__b')).toBe(false);
  });

  it('should keep the reason a cheer was refused', async () => {
    // given
    const { store, api } = setup();
    api.cheer.mockResolvedValue({ ok: false, reason: 'already' });

    // when
    const ok = await store.cheer('b');

    // then
    expect(ok).toBe(false);
    expect(store.lastRejection()).toBe('already');
    expect(api.board).not.toHaveBeenCalled();
  });

  it('should empty the board rather than break the page', async () => {
    // given
    const { store, api } = setup();
    api.board.mockRejectedValue(new Error('offline'));

    // when
    await store.loadBoard('week');

    // then
    expect(store.board()).toEqual([]);
  });
});
