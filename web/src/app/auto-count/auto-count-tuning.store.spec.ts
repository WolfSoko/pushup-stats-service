import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TuningProfileDoc } from './auto-count-tuning.models';
import { AutoCountTuningService } from './auto-count-tuning.service';
import { AutoCountTuningStore } from './auto-count-tuning.store';

const PUBLISHED: TuningProfileDoc = {
  exerciseId: 'pushup',
  kind: 'angle',
  values: { downAngleDeg: 80 },
  published: true,
};

const DRAFTED: TuningProfileDoc = {
  exerciseId: 'squat',
  kind: 'angle',
  values: { upAngleDeg: 170 },
  published: false,
};

describe('AutoCountTuningStore', () => {
  let load: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;

  const setup = (options: {
    isAdmin?: boolean;
    profiles?: ReadonlyArray<TuningProfileDoc>;
  }): AutoCountTuningStore => {
    TestBed.resetTestingModule();
    load = vi.fn().mockResolvedValue(options.profiles ?? []);
    save = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: AutoCountTuningService, useValue: { load, save } },
        {
          provide: UserContextService,
          useValue: {
            isAdmin: () => options.isAdmin ?? false,
            userIdSafe: () => 'admin-uid',
          },
        },
      ],
    });
    return TestBed.inject(AutoCountTuningStore);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('given a published profile, when a non-admin asks for the override, then it applies', async () => {
    // given
    const store = setup({ isAdmin: false, profiles: [PUBLISHED] });

    // when
    await store.ensureLoaded();

    // then
    expect(store.angleOverrideFor('pushup')).toEqual({ downAngleDeg: 80 });
  });

  it('given an unpublished profile, when a non-admin asks for the override, then it stays invisible', async () => {
    // given
    const store = setup({ isAdmin: false, profiles: [DRAFTED] });

    // when
    await store.ensureLoaded();

    // then
    expect(store.angleOverrideFor('squat')).toBeNull();
  });

  it('given an unpublished profile, when an admin asks for the override, then it applies', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [DRAFTED] });

    // when
    await store.ensureLoaded();

    // then
    expect(store.angleOverrideFor('squat')).toEqual({ upAngleDeg: 170 });
  });

  it('given an unsaved slider move, when the detector asks, then the draft wins over the stored value', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [PUBLISHED] });
    await store.ensureLoaded();

    // when
    store.setValue('pushup', 'angle', 'downAngleDeg', 70);

    // then
    expect(store.angleOverrideFor('pushup')).toEqual({ downAngleDeg: 70 });
    expect(store.hasDraft('pushup')).toBe(true);
  });

  it('given a draft, when it is discarded, then the stored profile is in force again', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [PUBLISHED] });
    await store.ensureLoaded();
    store.setValue('pushup', 'angle', 'downAngleDeg', 70);

    // when
    store.discardDraft('pushup');

    // then
    expect(store.angleOverrideFor('pushup')).toEqual({ downAngleDeg: 80 });
  });

  it('given a tuned profile, when reset to defaults, then no override is reported', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [PUBLISHED] });
    await store.ensureLoaded();

    // when
    store.resetToDefaults('pushup');

    // then
    expect(store.angleOverrideFor('pushup')).toBeNull();
    expect(store.isTuned('pushup')).toBe(false);
  });

  it('given a draft, when saved, then it is written through and no longer counts as unsaved', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [] });
    await store.ensureLoaded();
    store.setValue('pushup', 'angle', 'downAngleDeg', 75);

    // when
    await store.save('pushup', 'angle', true);

    // then
    expect(save).toHaveBeenCalledWith(
      {
        exerciseId: 'pushup',
        kind: 'angle',
        values: { downAngleDeg: 75 },
        published: true,
      },
      'admin-uid'
    );
    expect(store.hasDraft('pushup')).toBe(false);
    expect(store.publishedFor('pushup')).toBe(true);
  });

  it('given a failing write, when saved, then the draft survives and the error is surfaced', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [] });
    await store.ensureLoaded();
    save.mockRejectedValue(new Error('permission denied'));
    store.setValue('pushup', 'angle', 'downAngleDeg', 75);

    // when
    await expect(store.save('pushup', 'angle', false)).rejects.toThrow(
      'permission denied'
    );

    // then
    expect(store.hasDraft('pushup')).toBe(true);
    expect(store.error()).toContain('permission denied');
  });

  it('given a failing load, when the detector asks, then it falls back to the catalog defaults', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [] });
    load.mockRejectedValue(new Error('offline'));

    // when
    await store.ensureLoaded();

    // then
    expect(store.angleOverrideFor('pushup')).toBeNull();
    expect(store.error()).toContain('offline');
  });

  it('given several callers, when they all ensure the load, then it is requested once', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [PUBLISHED] });

    // when
    await Promise.all([
      store.ensureLoaded(),
      store.ensureLoaded(),
      store.ensureLoaded(),
    ]);

    // then
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('given a single cleared threshold, when the others remain, then only that key is dropped', async () => {
    // given
    const store = setup({ isAdmin: true, profiles: [] });
    await store.ensureLoaded();
    store.setValue('pushup', 'angle', 'downAngleDeg', 75);
    store.setValue('pushup', 'angle', 'upAngleDeg', 160);

    // when
    store.clearValue('pushup', 'angle', 'downAngleDeg');

    // then
    expect(store.angleOverrideFor('pushup')).toEqual({ upAngleDeg: 160 });
  });
  it('given a load that failed, when the dialog is opened again, then it is retried rather than cached', async () => {
    // given — offline on the first open
    const store = setup({ isAdmin: false, profiles: [PUBLISHED] });
    load.mockRejectedValueOnce(new Error('offline'));
    await store.ensureLoaded();
    expect(store.angleOverrideFor('pushup')).toBeNull();

    // when — connectivity is back on the next open
    await store.ensureLoaded();

    // then
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.angleOverrideFor('pushup')).toEqual({ downAngleDeg: 80 });
  });
});
