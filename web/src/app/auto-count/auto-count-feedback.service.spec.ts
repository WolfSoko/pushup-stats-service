import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { UserContextService } from '@pu-auth/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AutoCountFeedback } from './auto-count-feedback.models';
import {
  AUTO_COUNT_FEEDBACK_COLLECTION,
  AutoCountFeedbackService,
} from './auto-count-feedback.service';

const REPORT: AutoCountFeedback = {
  exerciseId: 'pushup',
  profileId: 'pushup',
  mode: 'pose',
  detectedReps: 12,
  actualReps: 14,
  thresholds: { upAngleDeg: 150 },
};

describe('AutoCountFeedbackService', () => {
  let service: AutoCountFeedbackService;
  let addDocFn: ReturnType<typeof vi.fn>;

  const setup = (options: { firestore?: unknown; uid?: string } = {}): void => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Firestore,
          useValue: 'firestore' in options ? options.firestore : {},
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => options.uid ?? 'uid-1' },
        },
      ],
    });
    service = TestBed.inject(AutoCountFeedbackService);
    addDocFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(service, 'collectionFn', {
      value: (_f: unknown, path: string) => ({ path }),
    });
    Object.defineProperty(service, 'addDocFn', { value: addDocFn });
    Object.defineProperty(service, 'serverTimestampFn', {
      value: () => 'server-time',
    });
  };

  beforeEach(() => {
    setup();
  });

  it('given a report, when submitted, then it lands in the auto-count feedback collection', async () => {
    // given / when
    await service.submit(REPORT);

    // then
    expect(addDocFn.mock.calls[0][0]).toEqual({
      path: AUTO_COUNT_FEEDBACK_COLLECTION,
    });
    expect(addDocFn.mock.calls[0][1]).toMatchObject({
      exerciseId: 'pushup',
      profileId: 'pushup',
      mode: 'pose',
      detectedReps: 12,
      actualReps: 14,
      thresholds: { upAngleDeg: 150 },
      userId: 'uid-1',
      createdAt: 'server-time',
    });
  });

  it('given a signed-out user, when submitted, then the report carries no user id', async () => {
    // given
    setup({ uid: '' });

    // when
    await service.submit(REPORT);

    // then
    expect(addDocFn.mock.calls[0][1].userId).toBeNull();
  });

  it('given the stored thresholds, when submitted, then they are copied rather than referenced', async () => {
    // given
    const thresholds = { upAngleDeg: 150 };

    // when
    await service.submit({ ...REPORT, thresholds });
    thresholds.upAngleDeg = 99;

    // then
    expect(addDocFn.mock.calls[0][1].thresholds).toEqual({ upAngleDeg: 150 });
  });

  it('given no Firestore, when submitted, then it is a silent no-op', async () => {
    // given
    setup({ firestore: null });

    // when / then
    await expect(service.submit(REPORT)).resolves.toBeUndefined();
    expect(addDocFn).not.toHaveBeenCalled();
  });
});
