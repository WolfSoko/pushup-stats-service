import { inject, Injectable } from '@angular/core';

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

/** Why the server refused a request; `undefined` when it accepted. */
export type FriendActionReason = string | undefined;

export interface FriendActionResponse {
  readonly ok: boolean;
  readonly reason?: FriendActionReason;
}

/**
 * The four friendship callables.
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

  async remove(id: string): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      { id: string },
      FriendActionResponse
    >('removeFriend')({ id });
    return result.data ?? { ok: false };
  }
}

function isUnauthenticated(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'functions/unauthenticated' || code === 'unauthenticated';
}
