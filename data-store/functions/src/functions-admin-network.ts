import { getAuth } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import type { Friendship } from '@pu-stats/models';

import { buildFriendshipGraph } from './admin/friendship-graph';
import { db } from './firebase-app';
import { FRIENDSHIPS_COLLECTION } from './friends/friendships-read';
import { assertAdmin } from './functions-admin';
import { displayNames, readUserConfigs } from './user-config-read';

/**
 * The friendship network, for the admin page to draw.
 *
 * One unfiltered pass over `friendships` — there is no per-user query
 * that answers "who is connected to whom". The cap is what keeps that
 * bounded; a truncated read says so rather than presenting a partial
 * network as the whole one.
 */
const MAX_FRIENDSHIPS = 5000;

export const adminFriendshipGraph = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const snap = await db
      .collection(FRIENDSHIPS_COLLECTION)
      .limit(MAX_FRIENDSHIPS + 1)
      .get();
    const truncated = snap.size > MAX_FRIENDSHIPS;
    const docs = snap.docs
      .slice(0, MAX_FRIENDSHIPS)
      .map((doc) => doc.data() as Friendship)
      .map((data) => ({
        users: data.users,
        requestedBy: data.requestedBy,
        status: String(data.status),
      }));

    const allUids: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await getAuth().listUsers(1000, pageToken);
      for (const user of page.users) allUids.push(user.uid);
      pageToken = page.pageToken;
    } while (pageToken);

    // Names for everyone, not just the connected: the isolated list is
    // the half an admin reads to find who never got started.
    const names = displayNames(await readUserConfigs(allUids));
    const graph = buildFriendshipGraph({ docs, names, allUids, truncated });

    logger.info('adminFriendshipGraph', {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      isolated: graph.isolated.length,
      truncated,
    });
    return graph;
  }
);
