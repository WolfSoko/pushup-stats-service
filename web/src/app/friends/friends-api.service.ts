import { inject, Injectable } from '@angular/core';
import type { CheerRejection, FriendRequestRejection } from '@pu-stats/models';

import { CallableFunctionsService } from '../admin/callable-functions.service';

/** One row of the friends screen, as the `listFriends` callable returns it. */
export interface FriendRow {
  readonly id: string;
  readonly uid: string;
  readonly since: string;
  readonly displayName: string | null;
}

export interface FriendListsResponse {
  readonly friends: ReadonlyArray<FriendRow>;
  readonly incoming: ReadonlyArray<FriendRow>;
  readonly outgoing: ReadonlyArray<FriendRow>;
}

export type FriendsBoardPeriod = 'daily' | 'week' | 'month' | 'allTime';

export interface FriendsBoardEntry {
  readonly uid: string;
  readonly displayName: string | null;
  readonly value: number;
  readonly isViewer: boolean;
  /** Cheers this participant received today. */
  readonly cheers: number;
  /** Whether the viewer already cheered them today. */
  readonly cheered: boolean;
}

export interface FriendsBoardResponse {
  readonly exerciseId: string;
  readonly period: FriendsBoardPeriod;
  readonly entries: ReadonlyArray<FriendsBoardEntry>;
}

/**
 * Why the server refused; `undefined` when it accepted. The codes are
 * `friendRequestRejection` / `cheerRejection` from the models, the
 * callables' own `respondRejection`, and two the client adds itself.
 */
export type FriendActionReason =
  | FriendRequestRejection
  | CheerRejection
  | 'not-found'
  | 'not-yours'
  | 'settled'
  | 'unauthenticated'
  | 'failed'
  | undefined;

export interface FriendActionResponse {
  readonly ok: boolean;
  readonly reason?: FriendActionReason;
}

/**
 * The friendship callables.
 *
 * Every write goes through them — `friendships` is Admin-SDK-only, because
 * the status of a friendship decides what the other side may see.
 */
@Injectable({ providedIn: 'root' })
export class FriendsApiService {
  private readonly callables = inject(CallableFunctionsService);

  async list(): Promise<FriendListsResponse> {
    const result = await this.callables.call<
      Record<string, never>,
      FriendListsResponse
    >('listFriends')({});
    return result.data ?? { friends: [], incoming: [], outgoing: [] };
  }

  async request(uid: string): Promise<FriendActionResponse> {
    try {
      const result = await this.callables.call<
        { uid: string },
        FriendActionResponse
      >('sendFriendRequest')({ uid });
      return result.data ?? { ok: false };
    } catch (err) {
      // A visitor without an account clicking "add friend" is a signup
      // opportunity, not an error — the caller routes on this reason.
      if (isUnauthenticated(err)) {
        return { ok: false, reason: 'unauthenticated' };
      }
      throw err;
    }
  }

  async respond(id: string, accept: boolean): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      { id: string; accept: boolean },
      FriendActionResponse
    >('respondFriendRequest')({ id, accept });
    return result.data ?? { ok: false };
  }

  async board(
    period: FriendsBoardPeriod,
    exerciseId?: string
  ): Promise<ReadonlyArray<FriendsBoardEntry>> {
    const result = await this.callables.call<
      { period: FriendsBoardPeriod; exerciseId?: string },
      FriendsBoardResponse
    >('getFriendsLeaderboard')({ period, exerciseId });
    return result.data?.entries ?? [];
  }

  async remove(id: string): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      { id: string },
      FriendActionResponse
    >('removeFriend')({ id });
    return result.data ?? { ok: false };
  }

  async cheer(uid: string): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      { uid: string },
      FriendActionResponse
    >('sendCheer')({ uid });
    return result.data ?? { ok: false };
  }
}

function isUnauthenticated(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'functions/unauthenticated' || code === 'unauthenticated';
}
