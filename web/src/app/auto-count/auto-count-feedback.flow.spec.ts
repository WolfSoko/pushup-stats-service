import { TestBed } from '@angular/core/testing';
import { PUSHUP_PROFILE } from '@pu-stats/auto-count';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AutoCountFeedbackFlow,
  type AutoCountRunContext,
} from './auto-count-feedback.flow';
import { AUTO_COUNT_FEEDBACK_STORAGE_KEY } from './auto-count-feedback.models';
import { AutoCountFeedbackService } from './auto-count-feedback.service';
import { AutoCountTuningStore } from './auto-count-tuning.store';

const POSE_RUN: AutoCountRunContext = {
  exerciseId: 'pushup',
  profileId: 'pushup',
  mode: 'pose',
  detectedReps: 12,
};

describe('AutoCountFeedbackFlow', () => {
  let submit: ReturnType<typeof vi.fn>;
  let angleOverrideFor: ReturnType<typeof vi.fn>;
  let flow: AutoCountFeedbackFlow;

  const setup = (): void => {
    TestBed.resetTestingModule();
    submit = vi.fn().mockResolvedValue(undefined);
    angleOverrideFor = vi.fn().mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: AutoCountFeedbackService, useValue: { submit } },
        { provide: AutoCountTuningStore, useValue: { angleOverrideFor } },
      ],
    });
    flow = TestBed.inject(AutoCountFeedbackFlow);
  };

  beforeEach(() => {
    localStorage.clear();
    setup();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('given a fresh device, when asked, then the accuracy question is on by default', () => {
    // given / when / then
    expect(flow.shouldAsk()).toBe(true);
  });

  it('given the user opted out, when asked again, then the question stays off', () => {
    // given / when
    flow.disable();

    // then
    expect(flow.shouldAsk()).toBe(false);
    expect(localStorage.getItem(AUTO_COUNT_FEEDBACK_STORAGE_KEY)).toBe('off');
  });

  it('given a pose run on catalog defaults, when recorded, then the report carries those thresholds', async () => {
    // given / when
    await flow.record(POSE_RUN, 14);

    // then
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'pushup',
        profileId: 'pushup',
        mode: 'pose',
        detectedReps: 12,
        actualReps: 14,
      })
    );
    const { thresholds } = submit.mock.calls[0][0];
    expect(thresholds.upAngleDeg).toBe(PUSHUP_PROFILE.upAngleDeg);
    expect(thresholds.downAngleDeg).toBe(PUSHUP_PROFILE.downAngleDeg);
  });

  it('given a tuned profile, when recorded, then the override wins over the default', async () => {
    // given
    angleOverrideFor.mockReturnValue({ downAngleDeg: 75 });

    // when
    await flow.record(POSE_RUN, 12);

    // then
    const { thresholds } = submit.mock.calls[0][0];
    expect(thresholds.downAngleDeg).toBe(75);
    expect(thresholds.upAngleDeg).toBe(PUSHUP_PROFILE.upAngleDeg);
  });

  it('given a tuned profile that does not apply to this user, when recorded, then the defaults are reported', async () => {
    // given — an unpublished profile: the store gates it, the detector
    // ran on the catalog values, so that is what must be filed
    angleOverrideFor.mockReturnValue(null);

    // when
    await flow.record(POSE_RUN, 12);

    // then
    const { thresholds } = submit.mock.calls[0][0];
    expect(thresholds.downAngleDeg).toBe(PUSHUP_PROFILE.downAngleDeg);
  });

  it('given a proximity run, when recorded, then no joint thresholds are claimed', async () => {
    // given / when
    await flow.record({ ...POSE_RUN, mode: 'proximity' }, 12);

    // then
    expect(submit.mock.calls[0][0].thresholds).toEqual({});
  });

  it('given the write fails, when recorded, then the caller is not made to care', async () => {
    // given
    submit.mockRejectedValue(new Error('offline'));

    // when / then
    await expect(flow.record(POSE_RUN, 12)).resolves.toBeUndefined();
  });

  it('given storage that throws, when asked, then the question still defaults to on', () => {
    // given
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    // when / then
    expect(flow.shouldAsk()).toBe(true);
  });
});
