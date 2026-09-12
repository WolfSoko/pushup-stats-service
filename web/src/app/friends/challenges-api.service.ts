import { inject, Injectable } from '@angular/core';
import type { ChallengeDurationDays } from '@pu-stats/models';

import { CallableFunctionsService } from '../admin/callable-functions.service';
import type { FriendActionResponse } from './friends-api.service';

export interface ChallengeEntry {
  readonly uid: string;
  readonly displayName: string | null;
  readonly value: number;
  readonly isViewer: boolean;
}

export interface ChallengeView {
  readonly id: string;
  readonly createdBy: string;
  readonly exerciseId: string;
  readonly target: number;
  readonly from: string;
  readonly to: string;
  readonly status: 'active' | 'ended';
  readonly entries: ReadonlyArray<ChallengeEntry>;
}

export interface CreateChallengeInput {
  readonly friendUids: ReadonlyArray<string>;
  readonly exerciseId: string;
  /** The label the picker showed, for the invitation push. */
  readonly exerciseName: string;
  readonly target: number;
  readonly days: ChallengeDurationDays;
}

/** The challenge callables; `challenges` is Admin-SDK-only. */
@Injectable({ providedIn: 'root' })
export class ChallengesApiService {
  private readonly callables = inject(CallableFunctionsService);

  async list(): Promise<ReadonlyArray<ChallengeView>> {
    const result = await this.callables.call<
      Record<string, never>,
      { challenges: ReadonlyArray<ChallengeView> }
    >('listChallenges')({});
    return result.data?.challenges ?? [];
  }

  async create(input: CreateChallengeInput): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      CreateChallengeInput,
      FriendActionResponse
    >('createChallenge')(input);
    return result.data ?? { ok: false };
  }

  async leave(id: string): Promise<FriendActionResponse> {
    const result = await this.callables.call<
      { id: string },
      FriendActionResponse
    >('leaveChallenge')({ id });
    return result.data ?? { ok: false };
  }
}
