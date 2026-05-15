import { PLANK_HOLD_PROFILE } from './exercise-hold-profile';
import { HoldStateMachine } from './hold-state-machine';
import type { PoseSample } from './pose-sample';

const sample = (
  timestampMs: number,
  angleDeg: number,
  confidence = 0.9
): PoseSample => ({ timestampMs, angleDeg, confidence });

const feed = (machine: HoldStateMachine, samples: PoseSample[]): void => {
  for (const s of samples) machine.process(s);
};

const inPose = 170;
const outPose = 110;

describe('HoldStateMachine (plank profile)', () => {
  it('given a fresh machine, when snapshot is read, then totalMs is 0 and phase idle', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    expect(machine.snapshot()).toEqual({
      totalMs: 0,
      phase: 'idle',
      segmentStartMs: null,
    });
  });

  it('given in-pose samples below minHoldMs, when processed, then phase is still idle', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(200, inPose),
      sample(500, inPose),
    ]);
    expect(machine.snapshot().phase).toBe('idle');
    expect(machine.snapshot().totalMs).toBe(0);
  });

  it('given in-pose samples crossing minHoldMs, when processed, then phase becomes holding and segmentStartMs is the first in-pose sample', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(300, inPose),
      sample(600, inPose),
    ]);
    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().segmentStartMs).toBe(0);
  });

  it('given a steady 5-second hold, when processed, then totalMs ≈ 5000', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    const samples: PoseSample[] = [];
    for (let t = 0; t <= 5000; t += 100) samples.push(sample(t, inPose));
    feed(machine, samples);
    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().totalMs).toBe(5000);
  });

  it('given a hold then a confirmed break, when processed, then phase becomes paused and totalMs is preserved at the break boundary', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    const samples: PoseSample[] = [];
    for (let t = 0; t <= 3000; t += 100) samples.push(sample(t, inPose));
    for (let t = 3100; t <= 5000; t += 100) samples.push(sample(t, outPose));
    feed(machine, samples);
    expect(machine.snapshot().phase).toBe('paused');
    expect(machine.snapshot().totalMs).toBeGreaterThanOrEqual(2900);
    expect(machine.snapshot().totalMs).toBeLessThanOrEqual(3100);
  });

  it('given a brief out-of-pose blip shorter than minBreakMs, when processed, then the timer keeps running', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    const samples: PoseSample[] = [];
    for (let t = 0; t <= 3000; t += 100) samples.push(sample(t, inPose));
    samples.push(sample(3100, outPose));
    samples.push(sample(3300, outPose));
    for (let t = 3400; t <= 5000; t += 100) samples.push(sample(t, inPose));
    feed(machine, samples);
    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().totalMs).toBeGreaterThanOrEqual(4500);
  });

  it('given a paused machine, when in-pose resumes, then totalMs continues from the previous total', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    const samples: PoseSample[] = [];
    for (let t = 0; t <= 3000; t += 100) samples.push(sample(t, inPose));
    for (let t = 3100; t <= 5000; t += 100) samples.push(sample(t, outPose));
    feed(machine, samples);
    const totalAfterPause = machine.snapshot().totalMs;

    const resume: PoseSample[] = [];
    for (let t = 6000; t <= 9000; t += 100) resume.push(sample(t, inPose));
    feed(machine, resume);

    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().totalMs).toBeGreaterThan(totalAfterPause);
    expect(machine.snapshot().totalMs).toBeLessThanOrEqual(
      totalAfterPause + 3000
    );
  });

  it('given samples below minConfidence only, when processed, then they are dropped and the machine stays idle', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose, 0.1),
      sample(300, inPose, 0.1),
      sample(600, inPose, 0.1),
    ]);
    expect(machine.snapshot().phase).toBe('idle');
    expect(machine.snapshot().totalMs).toBe(0);
  });

  it('given a long inter-sample gap during holding, when processed, then the gap credit is capped at maxFrameGapMs', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(300, inPose),
      sample(600, inPose),
    ]);
    expect(machine.snapshot().phase).toBe('holding');
    const totalAtStart = machine.snapshot().totalMs;
    feed(machine, [sample(10_000, inPose)]);
    const delta = machine.snapshot().totalMs - totalAtStart;
    expect(delta).toBe(PLANK_HOLD_PROFILE.maxFrameGapMs);
  });

  it('given reset, when called, then state returns to idle/0', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(500, inPose),
      sample(1000, inPose),
      sample(1500, inPose),
    ]);
    expect(machine.snapshot().phase).toBe('holding');
    machine.reset();
    expect(machine.snapshot()).toEqual({
      totalMs: 0,
      phase: 'idle',
      segmentStartMs: null,
    });
  });

  it('given an angle in the hysteresis dead-zone while holding, when processed, then the timer keeps accumulating', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(300, inPose),
      sample(600, inPose),
    ]);
    const totalAtStart = machine.snapshot().totalMs;
    feed(machine, [sample(800, 150)]);
    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().totalMs).toBeGreaterThan(totalAtStart);
  });

  it('given a leave-candidate followed by dead-zone samples, when processed, then accumulation continues (no display freeze)', () => {
    const machine = new HoldStateMachine(PLANK_HOLD_PROFILE);
    feed(machine, [
      sample(0, inPose),
      sample(300, inPose),
      sample(600, inPose),
    ]);
    const totalAtHolding = machine.snapshot().totalMs;
    // Out-zone arms a leave candidate; the immediate next sample
    // drifts back into the hysteresis dead-zone (between in- and
    // out-thresholds). Pre-fix, accumulation froze here because the
    // dead-zone branch guarded against an active candidate. Post-fix
    // the timer keeps ticking forward until a decisive sample resolves
    // the candidate.
    feed(machine, [sample(700, outPose), sample(900, 150), sample(1100, 150)]);
    expect(machine.snapshot().phase).toBe('holding');
    expect(machine.snapshot().totalMs).toBeGreaterThan(totalAtHolding);
  });
});
