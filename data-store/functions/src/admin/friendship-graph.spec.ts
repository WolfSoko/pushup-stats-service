import { buildFriendshipGraph } from './friendship-graph';

describe('admin/friendship-graph', () => {
  function doc(
    users: [string, string],
    requestedBy: string,
    status: string
  ): { users: [string, string]; requestedBy: string; status: string } {
    return { users, requestedBy, status };
  }

  const names = new Map([
    ['a', 'Ada'],
    ['b', 'Wolf'],
  ]);

  it('should draw one edge per friendship, pointing away from who asked', () => {
    // given — direction is the only thing an open request adds
    const docs = [doc(['a', 'b'], 'b', 'pending')];

    // when
    const graph = buildFriendshipGraph({ docs, names, allUids: ['a', 'b'] });

    // then
    expect(graph.edges).toEqual([
      { source: 'b', target: 'a', status: 'pending' },
    ]);
  });

  it('should count confirmed friends on both sides and nothing else', () => {
    // given — only an accepted friendship is a friendship
    const docs = [
      doc(['a', 'b'], 'a', 'accepted'),
      doc(['a', 'c'], 'a', 'pending'),
      doc(['a', 'd'], 'd', 'declined'),
    ];

    // when
    const graph = buildFriendshipGraph({
      docs,
      names,
      allUids: ['a', 'b', 'c', 'd'],
    });

    // then
    const friends = Object.fromEntries(
      graph.nodes.map((n) => [n.uid, n.friends])
    );
    expect(friends).toEqual({ a: 1, b: 1, c: 0, d: 0 });
  });

  it('should carry the display name, and cope without one', () => {
    // given
    const docs = [doc(['a', 'z'], 'a', 'accepted')];

    // when
    const graph = buildFriendshipGraph({ docs, names, allUids: ['a', 'z'] });

    // then
    expect(graph.nodes).toEqual([
      { uid: 'a', displayName: 'Ada', friends: 1 },
      { uid: 'z', displayName: null, friends: 1 },
    ]);
  });

  it('should keep every drawable status', () => {
    // given
    const docs = [
      doc(['a', 'b'], 'a', 'accepted'),
      doc(['a', 'c'], 'a', 'pending'),
      doc(['a', 'd'], 'd', 'declined'),
    ];

    // when
    const graph = buildFriendshipGraph({
      docs,
      names,
      allUids: ['a', 'b', 'c', 'd'],
    });

    // then
    expect(graph.edges.map((e) => e.status).sort()).toEqual([
      'accepted',
      'declined',
      'pending',
    ]);
  });

  it('should count accounts in no friendship rather than draw them', () => {
    // given — at any real user count the lone dots would be the picture
    const docs = [doc(['a', 'b'], 'a', 'accepted')];

    // when
    const graph = buildFriendshipGraph({
      docs,
      names,
      allUids: ['a', 'b', 'lonely-2', 'lonely-1'],
    });

    // then — sorted, so the list does not reshuffle between reads
    expect(graph.nodes.map((n) => n.uid)).toEqual(['a', 'b']);
    expect(graph.isolated).toEqual([
      { uid: 'lonely-1', displayName: null },
      { uid: 'lonely-2', displayName: null },
    ]);
  });

  it('should skip a record that would invent a participant', () => {
    // given — `requestedBy` is not one of its own `users`
    const docs = [doc(['a', 'b'], 'stranger', 'accepted')];

    // when
    const graph = buildFriendshipGraph({ docs, names, allUids: ['a', 'b'] });

    // then
    expect(graph.edges).toEqual([]);
    expect(graph.nodes).toEqual([]);
  });

  it('should ignore a status it cannot draw', () => {
    // given — a value a future state machine might add
    const docs = [doc(['a', 'b'], 'a', 'blocked')];

    // when
    const graph = buildFriendshipGraph({ docs, names, allUids: ['a', 'b'] });

    // then
    expect(graph.edges).toEqual([]);
  });

  it('should report a partial read rather than look complete', () => {
    // when / then
    expect(
      buildFriendshipGraph({ docs: [], names, allUids: [], truncated: true })
        .truncated
    ).toBe(true);
    expect(
      buildFriendshipGraph({ docs: [], names, allUids: [] }).truncated
    ).toBe(false);
  });
});
