import { TestBed } from '@angular/core/testing';

import { FriendsApiService, type FriendRow } from './friends-api.service';
import { FriendsStore } from './friends.store';

describe('FriendsStore', () => {
  const friend: FriendRow = {
    id: 'a__b',
    uid: 'b',
    since: '2026-09-01T10:00:00.000Z',
    displayName: 'Wolf',
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
    expect(api.board).toHaveBeenCalledWith('allTime');
    expect(store.boardPeriod()).toBe('allTime');
  });

  it('should reuse the last period when none is given', async () => {
    // given
    const { store, api } = setup();
    await store.loadBoard('month');
    api.board.mockClear();

    // when
    await store.loadBoard();

    // then
    expect(api.board).toHaveBeenCalledWith('month');
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
    expect(api.board).toHaveBeenCalledWith('daily');
    expect(api.list).not.toHaveBeenCalled();
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
