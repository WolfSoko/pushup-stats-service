import type {
  AngleProfileOverride,
  HoldProfileOverride,
} from '@pu-stats/auto-count';

/** Which detector a stored profile belongs to. */
export type TuningKind = 'angle' | 'hold';

/**
 * One adjustable threshold, with the bounds the slider offers. The
 * bounds are deliberately wider than any sane value: the point of the
 * panel is to find out where the useful range actually is.
 */
export interface TuningParam {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
}

export const ANGLE_TUNING_PARAMS: ReadonlyArray<TuningParam> = [
  {
    key: 'upAngleDeg',
    label: $localize`:@@autoCount.tuning.upAngle:Oben ab`,
    hint: $localize`:@@autoCount.tuning.upAngleHint:Gelenk gilt ab diesem Winkel als gestreckt`,
    min: 90,
    max: 180,
    step: 1,
    unit: '°',
  },
  {
    key: 'downAngleDeg',
    label: $localize`:@@autoCount.tuning.downAngle:Unten bis`,
    hint: $localize`:@@autoCount.tuning.downAngleHint:Gelenk gilt bis zu diesem Winkel als gebeugt`,
    min: 20,
    max: 150,
    step: 1,
    unit: '°',
  },
  {
    key: 'minDwellMs',
    label: $localize`:@@autoCount.tuning.minDwell:Haltezeit`,
    hint: $localize`:@@autoCount.tuning.minDwellHint:So lange muss eine Phase anliegen, bevor sie zählt`,
    min: 0,
    max: 1000,
    step: 25,
    unit: 'ms',
  },
  {
    key: 'minConfidence',
    label: $localize`:@@autoCount.tuning.minConfidence:Mindestsicherheit`,
    hint: $localize`:@@autoCount.tuning.minConfidenceHint:Frames mit schlechter Erkennung werden verworfen`,
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
  },
  {
    key: 'maxFrameGapMs',
    label: $localize`:@@autoCount.tuning.maxFrameGap:Max. Lücke`,
    hint: $localize`:@@autoCount.tuning.maxFrameGapHint:Längere Tracking-Aussetzer verwerfen die laufende Phase`,
    min: 100,
    max: 2000,
    step: 50,
    unit: 'ms',
  },
];

export const HOLD_TUNING_PARAMS: ReadonlyArray<TuningParam> = [
  {
    key: 'inPoseAngleDeg',
    label: $localize`:@@autoCount.tuning.inPoseAngle:In Position ab`,
    hint: $localize`:@@autoCount.tuning.inPoseAngleHint:Ab diesem Winkel gilt die Haltung als sauber`,
    min: 90,
    max: 180,
    step: 1,
    unit: '°',
  },
  {
    key: 'outPoseAngleDeg',
    label: $localize`:@@autoCount.tuning.outPoseAngle:Raus bis`,
    hint: $localize`:@@autoCount.tuning.outPoseAngleHint:Darunter gilt die Haltung als verlassen`,
    min: 60,
    max: 175,
    step: 1,
    unit: '°',
  },
  {
    key: 'minHoldMs',
    label: $localize`:@@autoCount.tuning.minHold:Startverzögerung`,
    hint: $localize`:@@autoCount.tuning.minHoldHint:So lange muss die Position stehen, bevor die Uhr läuft`,
    min: 0,
    max: 3000,
    step: 50,
    unit: 'ms',
  },
  {
    key: 'minBreakMs',
    label: $localize`:@@autoCount.tuning.minBreak:Pausenverzögerung`,
    hint: $localize`:@@autoCount.tuning.minBreakHint:So lange muss die Position verlassen sein, bevor pausiert wird`,
    min: 0,
    max: 3000,
    step: 50,
    unit: 'ms',
  },
  {
    key: 'minConfidence',
    label: $localize`:@@autoCount.tuning.minConfidence:Mindestsicherheit`,
    hint: $localize`:@@autoCount.tuning.minConfidenceHint:Frames mit schlechter Erkennung werden verworfen`,
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
  },
  {
    key: 'maxFrameGapMs',
    label: $localize`:@@autoCount.tuning.maxFrameGap:Max. Lücke`,
    hint: $localize`:@@autoCount.tuning.maxFrameGapHint:Längere Tracking-Aussetzer verwerfen die laufende Phase`,
    min: 100,
    max: 2000,
    step: 50,
    unit: 'ms',
  },
];

export function paramsFor(kind: TuningKind): ReadonlyArray<TuningParam> {
  return kind === 'hold' ? HOLD_TUNING_PARAMS : ANGLE_TUNING_PARAMS;
}

/**
 * A tuned profile as stored in Firestore, one document per detector
 * profile id. `published` decides who it applies to: while false only
 * admins run on it, so a half-tuned threshold can be carried around on
 * a phone without changing what everyone else's counter does.
 */
export interface TuningProfileDoc {
  readonly exerciseId: string;
  readonly kind: TuningKind;
  readonly values: Readonly<Record<string, number>>;
  readonly published: boolean;
}

/**
 * Keeps only known keys with finite, in-range values. Anything else —
 * a renamed threshold, a hand-edited document, a slider that was left
 * empty — is dropped rather than fed to the state machine.
 */
export function sanitizeTuningValues(
  kind: TuningKind,
  raw: unknown
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (const param of paramsFor(kind)) {
    const value = source[param.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (value < param.min || value > param.max) continue;
    out[param.key] = value;
  }
  return out;
}

export function asAngleOverride(
  values: Readonly<Record<string, number>>
): AngleProfileOverride {
  return values as AngleProfileOverride;
}

export function asHoldOverride(
  values: Readonly<Record<string, number>>
): HoldProfileOverride {
  return values as HoldProfileOverride;
}
