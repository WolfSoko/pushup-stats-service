import { layoutGraph, nodeRadius } from './friendship-graph-layout';
import type { GraphEdge, GraphNode } from './friendship-graph.models';

describe('friendship-graph-layout', () => {
  const size = { width: 800, height: 600 };

  function node(uid: string, friends = 0): GraphNode {
    return { uid, displayName: uid.toUpperCase(), friends };
  }

  function edge(
    source: string,
    target: string,
    status: GraphEdge['status'] = 'accepted'
  ): GraphEdge {
    return { source, target, status };
  }

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  it('should place every node inside the canvas', () => {
    // given
    const nodes = [node('a', 2), node('b', 1), node('c'), node('d')];

    // when
    const layout = layoutGraph(nodes, [edge('a', 'b')], size);

    // then
    for (const placed of layout.nodes) {
      expect(placed.x).toBeGreaterThanOrEqual(placed.r);
      expect(placed.x).toBeLessThanOrEqual(size.width - placed.r);
      expect(placed.y).toBeGreaterThanOrEqual(placed.r);
      expect(placed.y).toBeLessThanOrEqual(size.height - placed.r);
    }
  });

  it('should produce the same picture for the same input', () => {
    // given — a reload must not reshuffle a network somebody is reading
    const nodes = [node('a', 1), node('b', 1), node('c')];
    const edges = [edge('a', 'b')];

    // when
    const first = layoutGraph(nodes, edges, size);
    const second = layoutGraph(nodes, edges, size);

    // then
    expect(second.nodes).toEqual(first.nodes);
  });

  it('should pull friends closer than people who declined each other', () => {
    // given — two pairs, identical but for the status between them
    const nodes = [node('a', 1), node('b', 1), node('c'), node('d')];
    const edges = [edge('a', 'b', 'accepted'), edge('c', 'd', 'declined')];

    // when
    const layout = layoutGraph(nodes, edges, size);
    const at = (uid: string) =>
      layout.nodes.find((n) => n.uid === uid) as { x: number; y: number };

    // then
    expect(distance(at('a'), at('b'))).toBeLessThan(distance(at('c'), at('d')));
  });

  it('should give each edge the coordinates of both its ends', () => {
    // given
    const nodes = [node('a', 1), node('b', 1)];

    // when
    const layout = layoutGraph(nodes, [edge('a', 'b')], size);
    const [drawn] = layout.edges;
    const a = layout.nodes.find((n) => n.uid === 'a');
    const b = layout.nodes.find((n) => n.uid === 'b');

    // then
    expect({ x: drawn.x1, y: drawn.y1 }).toEqual({ x: a?.x, y: a?.y });
    expect({ x: drawn.x2, y: drawn.y2 }).toEqual({ x: b?.x, y: b?.y });
  });

  it('should drop an edge naming somebody the graph does not carry', () => {
    // given — d3 throws on an unknown link end rather than skipping it
    const nodes = [node('a', 1)];

    // when
    const layout = layoutGraph(nodes, [edge('a', 'ghost')], size);

    // then
    expect(layout.edges).toEqual([]);
    expect(layout.nodes).toHaveLength(1);
  });

  it('should handle an empty graph without running a simulation', () => {
    // when / then
    expect(layoutGraph([], [], size)).toEqual({ nodes: [], edges: [] });
  });

  describe('Groups that share no edge', () => {
    /** Two clusters plus a lone pair — nothing links them to each other. */
    function disconnected() {
      const nodes = [
        node('h1', 3),
        node('a', 1),
        node('b', 1),
        node('c', 1),
        node('h2', 3),
        node('d', 1),
        node('e', 1),
        node('f', 1),
        node('x', 1),
        node('y', 1),
      ];
      const edges = [
        edge('h1', 'a'),
        edge('h1', 'b'),
        edge('h1', 'c'),
        edge('h2', 'd'),
        edge('h2', 'e'),
        edge('h2', 'f'),
        edge('x', 'y'),
      ];
      return { nodes, edges };
    }

    it('should keep them on the canvas instead of letting them drift off', () => {
      // given — the charge pushes components apart with nothing pulling
      // back, so they used to end up clipped at the edges
      const { nodes, edges } = disconnected();

      // when
      const layout = layoutGraph(nodes, edges, size);

      // then
      for (const placed of layout.nodes) {
        expect(placed.x).toBeGreaterThanOrEqual(0);
        expect(placed.x).toBeLessThanOrEqual(size.width);
        expect(placed.y).toBeGreaterThanOrEqual(0);
        expect(placed.y).toBeLessThanOrEqual(size.height);
      }
    });

    it('should not stack anybody against an edge of the canvas', () => {
      // given — clamping strays to the border drew a column of people who
      // share nothing, which reads as a group and is not one
      const { nodes, edges } = disconnected();

      // when
      const layout = layoutGraph(nodes, edges, size);

      // then no two nodes share an x within a hair of each other
      const xs = layout.nodes.map((n) => Math.round(n.x));
      expect(new Set(xs).size).toBe(xs.length);
    });

    it('should spread across the canvas rather than huddle in one corner', () => {
      // given
      const { nodes, edges } = disconnected();

      // when
      const layout = layoutGraph(nodes, edges, size);
      const xs = layout.nodes.map((n) => n.x);
      const ys = layout.nodes.map((n) => n.y);

      // then the drawing uses most of the room it was given
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
        size.width * 0.5
      );
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(
        size.height * 0.5
      );
    });

    it('should leave room for the label above the topmost node', () => {
      // given
      const { nodes, edges } = disconnected();

      // when
      const layout = layoutGraph(nodes, edges, size);

      // then
      const highest = Math.min(...layout.nodes.map((n) => n.y - n.r));
      expect(highest).toBeGreaterThan(12);
    });
  });

  describe('nodeRadius', () => {
    it('should grow with friends but flatten out', () => {
      // given — a hub must not swallow the canvas
      // when / then
      expect(nodeRadius(0)).toBeLessThan(nodeRadius(4));
      expect(nodeRadius(4)).toBeLessThan(nodeRadius(16));
      expect(nodeRadius(1000)).toBe(nodeRadius(10_000));
    });

    it('should survive a nonsensical count', () => {
      // when / then
      expect(nodeRadius(-5)).toBe(nodeRadius(0));
    });
  });
});
