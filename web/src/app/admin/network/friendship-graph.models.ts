/** The `adminFriendshipGraph` response, as the admin network page reads it. */

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
  readonly isolated: ReadonlyArray<Pick<GraphNode, 'uid' | 'displayName'>>;
  readonly truncated: boolean;
}

export const EMPTY_GRAPH: FriendshipGraph = {
  nodes: [],
  edges: [],
  isolated: [],
  truncated: false,
};
