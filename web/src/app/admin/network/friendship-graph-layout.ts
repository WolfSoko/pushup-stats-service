import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

import type {
  GraphEdge,
  GraphEdgeStatus,
  GraphNode,
} from './friendship-graph.models';

export interface PositionedNode extends GraphNode {
  readonly x: number;
  readonly y: number;
  /** Circle radius, grown from the confirmed-friend count. */
  readonly r: number;
}

export interface PositionedEdge extends GraphEdge {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface GraphLayout {
  readonly nodes: ReadonlyArray<PositionedNode>;
  readonly edges: ReadonlyArray<PositionedEdge>;
}

interface SimNode extends SimulationNodeDatum {
  uid: string;
  r: number;
}

/**
 * How hard each kind of relationship pulls two people together. A
 * decline is a relationship but not a connection, so it barely pulls —
 * otherwise two people who said no to each other would cluster as
 * tightly as friends, which is the opposite of what the picture means.
 */
const LINK_STRENGTH: Record<GraphEdgeStatus, number> = {
  accepted: 1,
  pending: 0.4,
  declined: 0.08,
};

const MIN_RADIUS = 5;
const MAX_RADIUS = 14;
/** Enough passes to settle; the layout is computed once, not animated. */
const TICKS = 300;

/** Bigger for more friends, but flattening — a hub must not swallow the canvas. */
export function nodeRadius(friends: number): number {
  return Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(Math.max(0, friends)) * 3);
}

/**
 * Runs the force simulation to rest and returns fixed coordinates.
 *
 * Seeded deterministically on a circle rather than left to d3's own
 * placement: identical input then yields an identical picture, so a
 * reload does not reshuffle a network the admin was reading — and the
 * layout becomes testable.
 */
export function layoutGraph(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  size: { width: number; height: number }
): GraphLayout {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const radius = Math.min(size.width, size.height) / 3;
  const simNodes: SimNode[] = nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    return {
      uid: node.uid,
      r: nodeRadius(node.friends),
      x: size.width / 2 + radius * Math.cos(angle),
      y: size.height / 2 + radius * Math.sin(angle),
    };
  });

  const byUid = new Map(simNodes.map((node) => [node.uid, node]));
  // An edge naming a node the graph does not carry would make d3 throw.
  const simLinks = edges
    .filter((edge) => byUid.has(edge.source) && byUid.has(edge.target))
    .map((edge) => ({
      source: byUid.get(edge.source) as SimNode,
      target: byUid.get(edge.target) as SimNode,
      status: edge.status,
    }));

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<
        SimNode,
        SimulationLinkDatum<SimNode> & { status: GraphEdgeStatus }
      >(simLinks)
        .id((node) => node.uid)
        .distance(60)
        .strength((link) => LINK_STRENGTH[link.status])
    )
    .force('charge', forceManyBody<SimNode>().strength(-160))
    .force('center', forceCenter(size.width / 2, size.height / 2))
    // `forceCenter` only recentres the mean, so nothing stops two groups
    // that share no edge from drifting apart until the charge runs out —
    // the picture then hangs off one corner with the rest clipped. A weak
    // pull toward the middle gives every component something to hold on to.
    .force('x', forceX<SimNode>(size.width / 2).strength(0.04))
    .force('y', forceY<SimNode>(size.height / 2).strength(0.04))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius((node) => node.r + 5)
        .iterations(3)
    )
    .stop();

  simulation.tick(TICKS);

  const fit = fitToBox(simNodes, size);
  const positioned = new Map<string, PositionedNode>();
  const laidOut = nodes.map((node, index) => {
    const sim = simNodes[index];
    const result: PositionedNode = {
      ...node,
      r: sim.r,
      x: fit.x(sim.x ?? 0),
      y: fit.y(sim.y ?? 0),
    };
    positioned.set(node.uid, result);
    return result;
  });

  const laidOutEdges = edges
    .map((edge) => {
      const from = positioned.get(edge.source);
      const to = positioned.get(edge.target);
      if (!from || !to) return null;
      return { ...edge, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    })
    .filter((edge): edge is PositionedEdge => edge !== null);

  return { nodes: laidOut, edges: laidOutEdges };
}

/** Headroom for the node itself plus the label that sits above it. */
const PADDING = MAX_RADIUS + 16;
/** Past this a three-node graph would be blown up into meaningless bubbles. */
const MAX_ZOOM = 1.6;

/**
 * Maps the settled coordinates into the viewport.
 *
 * Fitting rather than clamping: clamping pinned every stray node onto the
 * same edge, which read as a column of people who share nothing. Scaling
 * the whole arrangement keeps the relative structure — which is all a
 * force layout means — and fills the canvas whatever the graph's size.
 * Radii stay put, so marks do not shrink with the network.
 */
function fitToBox(
  simNodes: ReadonlyArray<SimNode>,
  size: { width: number; height: number }
): { x: (value: number) => number; y: (value: number) => number } {
  const xs = simNodes.map((node) => finite(node.x));
  const ys = simNodes.map((node) => finite(node.y));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const usableW = Math.max(1, size.width - 2 * PADDING);
  const usableH = Math.max(1, size.height - 2 * PADDING);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? usableW / spanX : MAX_ZOOM,
    spanY > 0 ? usableH / spanY : MAX_ZOOM,
    MAX_ZOOM
  );

  // Whatever is left over after scaling is split evenly, so a wide graph
  // sits centred rather than hugging the top-left corner.
  const offsetX = PADDING + (usableW - spanX * scale) / 2;
  const offsetY = PADDING + (usableH - spanY * scale) / 2;

  return {
    x: (value) => offsetX + (finite(value) - minX) * scale,
    y: (value) => offsetY + (finite(value) - minY) * scale,
  };
}

function finite(value: number | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}
