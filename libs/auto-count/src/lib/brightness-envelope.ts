export interface BrightnessEnvelopeOptions {
  /** EMA factor applied to each raw luma sample (0..1, higher = less smoothing). */
  readonly smoothing: number;
  /**
   * Fraction per second by which the min/max envelope relaxes toward the
   * current level, so a lighting change or a pause between sets does not
   * pin the envelope at a stale extreme.
   */
  readonly decayPerSec: number;
  /** Min luma spread (0..1) the envelope must span before positions are trusted. */
  readonly minRange: number;
}

export const DEFAULT_BRIGHTNESS_ENVELOPE: BrightnessEnvelopeOptions = {
  smoothing: 0.35,
  decayPerSec: 0.15,
  minRange: 0.06,
};

export interface ProximityPosition {
  /** 0 = brightest seen (body far away), 1 = darkest seen (body close). */
  readonly position: number;
  /** 1 once the envelope spans `minRange`, 0 while it is still calibrating. */
  readonly confidence: number;
}

/**
 * Turns a stream of mean-luma samples into a normalized near/far
 * position. A phone lying under the user sees the frame darken as the
 * body comes down and brighten as it rises; the envelope tracks the
 * running min/max of that signal so the detector needs no absolute
 * thresholds and works in any room light.
 */
export class BrightnessEnvelope {
  private ema: number | null = null;
  private min = 0;
  private max = 0;
  private lastTimestampMs: number | null = null;

  constructor(
    private readonly options: BrightnessEnvelopeOptions = DEFAULT_BRIGHTNESS_ENVELOPE
  ) {}

  push(luma: number, timestampMs: number): ProximityPosition {
    const value = Math.min(1, Math.max(0, luma));
    if (this.ema === null) {
      this.ema = value;
      this.min = value;
      this.max = value;
      this.lastTimestampMs = timestampMs;
      return { position: 0.5, confidence: 0 };
    }
    this.ema += this.options.smoothing * (value - this.ema);

    const dtSec =
      Math.max(0, timestampMs - (this.lastTimestampMs ?? timestampMs)) / 1000;
    this.lastTimestampMs = timestampMs;
    const relax = 1 - Math.exp(-this.options.decayPerSec * dtSec);
    this.min += (this.ema - this.min) * relax;
    this.max += (this.ema - this.max) * relax;
    this.min = Math.min(this.min, this.ema);
    this.max = Math.max(this.max, this.ema);

    const range = this.max - this.min;
    if (range < this.options.minRange) {
      return { position: 0.5, confidence: 0 };
    }
    return { position: (this.max - this.ema) / range, confidence: 1 };
  }

  reset(): void {
    this.ema = null;
    this.min = 0;
    this.max = 0;
    this.lastTimestampMs = null;
  }
}
