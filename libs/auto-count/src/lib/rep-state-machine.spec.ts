import { PUSHUP_PROFILE } from './exercise-angle-profile';
import type { PoseSample } from './pose-sample';
import { RepStateMachine } from './rep-state-machine';

const sample = (
  timestampMs: number,
  angleDeg: number,
  confidence = 0.9
): PoseSample => ({ timestampMs, angleDeg, confidence });

const feed = (machine: RepStateMachine, samples: PoseSample[]): void => {
  for (const s of samples) machine.process(s);
};

const cleanRep = (startMs: number): PoseSample[] => [
  sample(startMs + 0, 170),
  sample(startMs + 250, 170),
  sample(startMs + 300, 80),
  sample(startMs + 550, 80),
  sample(startMs + 600, 170),
  sample(startMs + 850, 170),
];

describe('RepStateMachine (pushup profile)', () => {
  it('given fresh machine, when snapshot is read, then count is 0 and phase awaiting-up', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    expect(machine.snapshot()).toEqual({
      count: 0,
      phase: 'awaiting-up',
      lastRepAtMs: null,
    });
  });

  it('given a clean down-up cycle after baseline up, when processed, then count = 1', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, cleanRep(0));
    expect(machine.snapshot().count).toBe(1);
    expect(machine.snapshot().phase).toBe('up');
    expect(machine.snapshot().lastRepAtMs).toBe(850);
  });

  it('given three back-to-back clean reps, when processed, then count = 3', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, cleanRep(0));
    feed(machine, cleanRep(1000));
    feed(machine, cleanRep(2000));
    expect(machine.snapshot().count).toBe(3);
  });

  it('given a brief noise dip into down zone <minDwellMs, when followed by up, then no rep counted', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [
      sample(0, 170),
      sample(250, 170),
      sample(300, 80),
      sample(380, 170),
      sample(500, 170),
    ]);
    expect(machine.snapshot().count).toBe(0);
    expect(machine.snapshot().phase).toBe('up');
  });

  it('given samples below minConfidence, when processed, then they are ignored', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [
      sample(0, 170),
      sample(250, 170),
      sample(300, 80, 0.3),
      sample(550, 80, 0.3),
      sample(600, 170, 0.3),
      sample(850, 170, 0.3),
    ]);
    expect(machine.snapshot().count).toBe(0);
    expect(machine.snapshot().phase).toBe('up');
  });

  it('given dead-zone samples between thresholds, when processed, then phase does not change', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [
      sample(0, 170),
      sample(250, 170),
      sample(300, 120),
      sample(500, 130),
      sample(700, 120),
    ]);
    expect(machine.snapshot().count).toBe(0);
    expect(machine.snapshot().phase).toBe('up');
  });

  it('given a confirmed rep, when reset is called, then state returns to initial', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, cleanRep(0));
    expect(machine.snapshot().count).toBe(1);

    machine.reset();
    expect(machine.snapshot()).toEqual({
      count: 0,
      phase: 'awaiting-up',
      lastRepAtMs: null,
    });
  });

  it('given the sample that triggers the rep, when processed, then repJustHappened is true', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    const events = cleanRep(0).map((s) => machine.process(s));
    const repEventIndex = events.findIndex((e) => e.repJustHappened);
    expect(repEventIndex).toBe(5);
    expect(events.filter((e) => e.repJustHappened).length).toBe(1);
  });

  it('given user starts in down position, when they go up cleanly, then first rep still counts', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [
      sample(0, 80),
      sample(250, 80),
      sample(300, 170),
      sample(550, 170),
    ]);
    expect(machine.snapshot().count).toBe(1);
  });

  it('given two sparse in-zone samples separated by a long dead-zone gap, when processed, then candidate does not commit prematurely', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [sample(0, 170), sample(250, 170)]);
    expect(machine.snapshot().phase).toBe('up');

    feed(machine, [
      sample(300, 80),
      sample(400, 120),
      sample(500, 120),
      sample(800, 120),
      sample(1200, 120),
      sample(1500, 80),
    ]);

    expect(machine.snapshot().phase).toBe('up');
    expect(machine.snapshot().count).toBe(0);
  });

  it('given a long low-confidence gap mid-cycle, when followed by confident up, then transition resumes correctly', () => {
    const machine = new RepStateMachine(PUSHUP_PROFILE);
    feed(machine, [
      sample(0, 170),
      sample(250, 170),
      sample(300, 80),
      sample(550, 80),
      sample(600, 170, 0.2),
      sample(700, 170, 0.2),
      sample(900, 170),
      sample(1200, 170),
    ]);
    expect(machine.snapshot().count).toBe(1);
  });
});
