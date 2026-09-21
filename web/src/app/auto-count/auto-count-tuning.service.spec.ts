import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTO_COUNT_PROFILES_COLLECTION,
  AutoCountTuningService,
} from './auto-count-tuning.service';
import { PendingRequestsService } from '@pu-stats/data-access';

const override = (
  service: AutoCountTuningService,
  key: string,
  value: unknown
): void => {
  Object.defineProperty(service, key, { value, writable: true });
};

const makeSnapshot = (
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) });

describe('AutoCountTuningService', () => {
  let service: AutoCountTuningService;
  let getDocsFn: ReturnType<typeof vi.fn>;
  let setDocFn: ReturnType<typeof vi.fn>;

  const setup = (firestore: unknown = {}): void => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Firestore, useValue: firestore }],
    });
    service = TestBed.inject(AutoCountTuningService);
    getDocsFn = vi.fn();
    setDocFn = vi.fn().mockResolvedValue(undefined);
    override(service, 'collectionFn', (_f: unknown, path: string) => ({
      path,
    }));
    override(service, 'docFn', (ref: { path: string }, id: string) => ({
      path: `${ref.path}/${id}`,
    }));
    override(service, 'getDocsFn', getDocsFn);
    override(service, 'setDocFn', setDocFn);
    override(service, 'serverTimestampFn', () => 'server-time');
  };

  beforeEach(() => {
    setup();
  });

  it('given stored documents, when loaded, then each becomes a sanitized profile', async () => {
    // given
    getDocsFn.mockResolvedValue(
      makeSnapshot([
        {
          id: 'pushup',
          data: {
            kind: 'angle',
            values: { downAngleDeg: 80, bogus: 1 },
            published: true,
          },
        },
        {
          id: 'plank',
          data: { kind: 'hold', values: { inPoseAngleDeg: 165 } },
        },
      ])
    );

    // when
    const profiles = await service.load();

    // then
    expect(profiles).toEqual([
      {
        exerciseId: 'pushup',
        kind: 'angle',
        values: { downAngleDeg: 80 },
        published: true,
      },
      {
        exerciseId: 'plank',
        kind: 'hold',
        values: { inPoseAngleDeg: 165 },
        published: false,
      },
    ]);
  });

  it('given a document without a kind, when loaded, then it is read as an angle profile', async () => {
    // given
    getDocsFn.mockResolvedValue(
      makeSnapshot([{ id: 'squat', data: { values: { upAngleDeg: 170 } } }])
    );

    // when
    const [profile] = await service.load();

    // then
    expect(profile.kind).toBe('angle');
    expect(profile.values).toEqual({ upAngleDeg: 170 });
  });

  it('given no Firestore, when loaded, then the result is empty rather than throwing', async () => {
    // given
    setup(null);

    // when
    const profiles = await service.load();

    // then
    expect(profiles).toEqual([]);
  });

  it('given a profile, when saved, then it is written to its own document with the author and a server timestamp', async () => {
    // given
    const profile = {
      exerciseId: 'pushup',
      kind: 'angle' as const,
      values: { downAngleDeg: 80 },
      published: false,
    };

    // when
    await service.save(profile, 'uid-1');

    // then
    expect(setDocFn).toHaveBeenCalledWith(
      { path: `${AUTO_COUNT_PROFILES_COLLECTION}/pushup` },
      {
        kind: 'angle',
        values: { downAngleDeg: 80 },
        published: false,
        updatedBy: 'uid-1',
        updatedAt: 'server-time',
      }
    );
  });

  it('given out-of-range values, when saved, then they are stripped before the write', async () => {
    // given
    const profile = {
      exerciseId: 'pushup',
      kind: 'angle' as const,
      values: { downAngleDeg: 80, upAngleDeg: 999 },
      published: false,
    };

    // when
    await service.save(profile, 'uid-1');

    // then
    expect(setDocFn.mock.calls[0][1].values).toEqual({ downAngleDeg: 80 });
  });

  it('given no Firestore, when saving, then it fails loudly', async () => {
    // given
    setup(null);

    // when / then
    await expect(
      service.save(
        { exerciseId: 'pushup', kind: 'angle', values: {}, published: false },
        'uid-1'
      )
    ).rejects.toThrow(/Firestore/);
  });

  it('given a slow read, when loading, then it counts as a pending request until it lands', async () => {
    // given
    const pending = TestBed.inject(PendingRequestsService);
    let resolveRead!: () => void;
    getDocsFn.mockReturnValue(
      new Promise((resolve) => (resolveRead = () => resolve(makeSnapshot([]))))
    );

    // when
    const load = service.load();

    // then
    expect(pending.pending()).toBe(1);

    // when
    resolveRead();
    await load;

    // then
    expect(pending.pending()).toBe(0);
  });

  it('given a slow write, when saving, then it counts as a pending request until it lands', async () => {
    // given
    const pending = TestBed.inject(PendingRequestsService);
    let resolveWrite!: () => void;
    setDocFn.mockReturnValue(
      new Promise<void>((resolve) => (resolveWrite = resolve))
    );

    // when
    const save = service.save(
      { exerciseId: 'pushup', kind: 'angle', values: {}, published: false },
      'admin-1'
    );

    // then
    expect(pending.pending()).toBe(1);

    // when
    resolveWrite();
    await save;

    // then
    expect(pending.pending()).toBe(0);
  });
});
