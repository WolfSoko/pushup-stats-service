export interface PieDatum {
  /**
   * Stable, locale-independent identifier used for selection state and
   * test selectors. Defaults to `label` when omitted, but production
   * callers should pass a canonical key (e.g. the canonical pushup
   * type id) so checkbox state and `data-testid` survive locale
   * switches and labels with spaces/diacritics.
   */
  id?: string;
  label: string;
  value: number;
  avgSetSize?: number;
}

export interface PieSegment {
  id: string;
  label: string;
  value: number;
  percent: number;
  color: string;
  avgSetSize: number;
}

export interface PieArcSegment extends PieSegment {
  dasharray: string;
  offset: number;
}
