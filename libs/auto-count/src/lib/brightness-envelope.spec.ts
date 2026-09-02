import { BrightnessEnvelope } from './brightness-envelope';

describe('BrightnessEnvelope', () => {
  it('should report no confidence until the envelope spans the minimum range', () => {
    // given
    const envelope = new BrightnessEnvelope({
      smoothing: 1,
      decayPerSec: 0,
      minRange: 0.1,
    });

    // when
    const first = envelope.push(0.5, 0);
    const flat = envelope.push(0.52, 100);

    // then
    expect(first.confidence).toBe(0);
    expect(flat.confidence).toBe(0);
    expect(flat.position).toBe(0.5);
  });

  it('should map the darkest level to position 1 and the brightest to 0', () => {
    // given
    const envelope = new BrightnessEnvelope({
      smoothing: 1,
      decayPerSec: 0,
      minRange: 0.1,
    });
    envelope.push(0.8, 0);

    // when
    const dark = envelope.push(0.2, 100);
    const bright = envelope.push(0.8, 200);
    const middle = envelope.push(0.5, 300);

    // then
    expect(dark).toEqual({ position: 1, confidence: 1 });
    expect(bright).toEqual({ position: 0, confidence: 1 });
    expect(middle.position).toBeCloseTo(0.5, 5);
  });

  it('should smooth raw samples so a single noisy frame moves the position only partly', () => {
    // given
    const envelope = new BrightnessEnvelope({
      smoothing: 0.5,
      decayPerSec: 0,
      minRange: 0.1,
    });
    envelope.push(0.8, 0);
    envelope.push(0.2, 100);
    envelope.push(0.2, 200);

    // when — one bright spike
    const spiked = envelope.push(0.8, 300);

    // then — halfway, not all the way back to bright
    expect(spiked.position).toBeCloseTo(0.5, 5);
  });

  it('should relax the envelope toward the current level over time', () => {
    // given
    const envelope = new BrightnessEnvelope({
      smoothing: 1,
      decayPerSec: 1,
      minRange: 0.05,
    });
    envelope.push(0.8, 0);
    envelope.push(0.2, 100);

    // when — hold bright for a long while
    let last = envelope.push(0.8, 200);
    for (let t = 1_200; t <= 10_200; t += 1_000) {
      last = envelope.push(0.8, t);
    }

    // then — the stale dark minimum has decayed away
    expect(last.confidence).toBe(0);
  });

  it('should start from scratch after reset', () => {
    // given
    const envelope = new BrightnessEnvelope({
      smoothing: 1,
      decayPerSec: 0,
      minRange: 0.1,
    });
    envelope.push(0.8, 0);
    envelope.push(0.2, 100);

    // when
    envelope.reset();

    // then
    expect(envelope.push(0.5, 200).confidence).toBe(0);
  });
});
