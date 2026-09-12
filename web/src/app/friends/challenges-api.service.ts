import { inject, Injectable } from '@angular/core';
import type {
  ChallengeDurationDays,
  ChallengeRejection,
  ChallengeRespondRejection,
} from '@pu-stats/models';

import { CallableFunctionsService } from '../admin/callable-functions.service';

export interface ChallengeEntry {
  readonly uid: string;
  readonly displayName: string | null;
  readonly value: number;
  readonly isViewer: boolean;
}

export interface ChallengeInvitee {
  readonly uid: string;
  readonly displayName: string | null;
}

export interface ChallengeView {
  readonly id: string;
  readonly createdBy: string;
  readonly exerciseId: string;
  readonly target: number;
  readonly from: string;
  readonly to: string;
  readonly status: 'active' | 'ended';
  /** Participants, highest first — empty while the viewer is only invited. */
  readonly entries: ReadonlyArray<ChallengeEntry>;
  readonly invited: ReadonlyArray<ChallengeInvitee>;
  readonly viewerInvited: boolean;
}

export interface CreateChallengeInput {
  readonly friendUids: ReadonlyArray<string>;
  readonly exerciseId: string;
  /** The label the picker showed, for the invitation push. */
  readonly exerciseName: string;
  readonly target: number;
  readonly days: ChallengeDurationDays;
}

/** Why the server refused; `failed` covers a thrown call. */
export type ChallengeActionReason =
  ChallengeRejection | ChallengeRespondRejection | 'failed' | undefined;

export interface ChallengeActionResponse {
  readonly ok: boolean;
  readonly reason?: ChallengeActionReason;
}

/** The challenge callables; `challenges` is Admin-SDK-only. */
@Injectable({ providedIn: 'root' })
export class ChallengesApiService {
  private readonly callables = inject(CallableFunctionsService);

  /** `progress: false` skips the per-participant sums — for surfaces that only count. */
  async list(options?: {
    progress?: boolean;
  }): Promise<ReadonlyArray<ChallengeView>> {
    const result = await this.callables.call<
      { progress?: boolean },
      { challenges: ReadonlyArray<ChallengeView> }
    >('listChallenges')({ progress: options?.progress ?? true });
    return result.data?.challenges ?? [];
  }

  async create(input: CreateChallengeInput): Promise<ChallengeActionResponse> {
    const result = await this.callables.call<
      CreateChallengeInput,
      ChallengeActionResponse
    >('createChallenge')(input);
    return result.data ?? { ok: false };
  }

  async respond(id: string, accept: boolean): Promise<ChallengeActionResponse> {
    const result = await this.callables.call<
      { id: string; accept: boolean },
      ChallengeActionResponse
    >('respondChallenge')({ id, accept });
    return result.data ?? { ok: false };
  }

  async leave(id: string): Promise<ChallengeActionResponse> {
    const result = await this.callables.call<
      { id: string },
      ChallengeActionResponse
    >('leaveChallenge')({ id });
    return result.data ?? { ok: false };
  }
}
