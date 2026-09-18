import { friendOf, type Friendship } from '@pu-stats/models';

/**
 * The friendship network as the admin page draws it: who is connected to
 * whom, and in which state.
 *
 * Pure, so the shape the client renders is testable without Firestore.
 * Direction only carries meaning for a request nobody has answered or a
 * request somebody refused — `source` is always the side that asked, so
 * the graph can point an arrow the right way.
 */

export type GraphEdgeStatus = 'accepted' | 'pending' | 'declined';

export interface GraphNode {
  readonly uid: string;
  readonly displayName: string | null;
  /** Confirmed friends — what sizes the node. */
  readonly friends: number;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly status: GraphEdgeStatus;
}

export interface FriendshipGraph {
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
  /** Accounts in no friendship at all — counted, not drawn. */
  readonly isolated: ReadonlyArray<Pick<GraphNode, 'uid' | 'displayName'>>;
  /** Whether the read hit its cap, so the picture is partial. */
  readonly truncated: boolean;
}

interface GraphInputDoc extends Pick<Friendship, 'users' | 'requestedBy'> {
  readonly status: string;
}

function isDrawable(status: string): status is GraphEdgeStatus {
  return status === 'accepted' || status === 'pending' || status === 'declined';
}

/**
 * Turns friendship documents into nodes and edges.
 *
 * `allUids` is every account that exists; the ones that never appear in a
 * document end up in `isolated` rather than as lone dots, which at any
 * real user count would be most of the picture.
 */
export function buildFriendshipGraph(args: {
  readonly docs: ReadonlyArray<GraphInputDoc>;
  readonly names: ReadonlyMap<string, string>;
  readonly allUids: ReadonlyArray<string>;
  readonly truncated?: boolean;
}): FriendshipGraph {
  const edges: GraphEdge[] = [];
  const friendCounts = new Map<string, number>();
  const involved = new Set<string>();

  for (const doc of args.docs) {
    if (!isDrawable(doc.status)) continue;
    const source = doc.requestedBy;
    const target = friendOf(doc, source);
    // A record whose `requestedBy` is not one of its own `users` is
    // corrupt; drawing it would invent a participant.
    if (!source || !target) continue;

    involved.add(source);
    involved.add(target);
    edges.push({ source, target, status: doc.status });

    if (doc.status === 'accepted') {
      friendCounts.set(source, (friendCounts.get(source) ?? 0) + 1);
      friendCounts.set(target, (friendCounts.get(target) ?? 0) + 1);
    }
  }

  const nodes = [...involved].sort().map((uid) => ({
    uid,
    displayName: args.names.get(uid) ?? null,
    friends: friendCounts.get(uid) ?? 0,
  }));

  const isolated = args.allUids
    .filter((uid) => !involved.has(uid))
    .sort()
    .map((uid) => ({ uid, displayName: args.names.get(uid) ?? null }));

  return { nodes, edges, isolated, truncated: args.truncated === true };
}
