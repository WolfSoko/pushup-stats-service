import { inject, Injectable } from '@angular/core';

import { CallableFunctionsService } from '../admin/callable-functions.service';

interface InviteResponse {
  readonly ok: boolean;
  readonly reason?: string;
  readonly token?: string;
}

/**
 * The two halves of the invite link: minting the caller's token and
 * redeeming somebody else's. Both are callables because `friendInvites`
 * is Admin-SDK-only — the token is a credential, so no client may read
 * one it was not handed.
 */
@Injectable({ providedIn: 'root' })
export class FriendInviteApiService {
  private readonly callables = inject(CallableFunctionsService);

  /** The caller's own token, `null` when the server refused (e.g. a guest). */
  async create(): Promise<string | null> {
    const result = await this.callables.call<
      Record<string, never>,
      InviteResponse
    >('createFriendInvite')({});
    return result.data?.ok ? (result.data.token ?? null) : null;
  }

  async claim(token: string): Promise<boolean> {
    const result = await this.callables.call<{ token: string }, InviteResponse>(
      'claimFriendInvite'
    )({ token });
    return result.data?.ok === true;
  }
}
