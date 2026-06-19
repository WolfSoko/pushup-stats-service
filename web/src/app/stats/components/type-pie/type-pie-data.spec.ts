import {
  buildAllSegments,
  buildArcSegments,
  PIE_PALETTE,
  percentOfSelected,
  pieTotal,
  selectedTotal,
  setsEqual,
  topNIds,
} from './type-pie-data';
import type { PieDatum } from './type-pie.models';

describe('type-pie-data', () => {
  describe('pieTotal', () => {
    it('should sum values, treating missing/zero as 0', () => {
      // given
      const data = [
        { label: 'a', value: 10 },
        { label: 'b', value: 0 },
        { label: 'c' } as PieDatum,
      ];
      // when
      const total = pieTotal(data);
      // then
      expect(total).toBe(10);
    });

    it('should return 0 for empty data', () => {
      // given / when / then
      expect(pieTotal([])).toBe(0);
    });
  });

  describe('buildAllSegments', () => {
    it('should sort descending, derive ids, percents and cycle colors', () => {
      // given
      const data: PieDatum[] = [
        { label: 'Low', value: 25 },
        { id: 'hi', label: 'High', value: 75 },
      ];
      // when
      const segments = buildAllSegments(data);
      // then
      expect(segments.map((s) => s.id)).toEqual(['hi', 'Low']);
      expect(segments[0].percent).toBe(75);
      expect(segments[1].percent).toBe(25);
      expect(segments[0].color).toBe(PIE_PALETTE[0]);
      expect(segments[1].color).toBe(PIE_PALETTE[1]);
    });

    it('should default id to label and avgSetSize to 0', () => {
      // given
      const data: PieDatum[] = [{ label: 'Only', value: 5 }];
      // when
      const [seg] = buildAllSegments(data);
      // then
      expect(seg.id).toBe('Only');
      expect(seg.avgSetSize).toBe(0);
    });

    it('should preserve provided avgSetSize', () => {
      // given
      const data: PieDatum[] = [{ label: 'a', value: 5, avgSetSize: 12 }];
      // when
      const [seg] = buildAllSegments(data);
      // then
      expect(seg.avgSetSize).toBe(12);
    });

    it('should drop non-positive values', () => {
      // given
      const data: PieDatum[] = [
        { label: 'a', value: 10 },
        { label: 'b', value: 0 },
        { label: 'c', value: -5 },
      ];
      // when
      const segments = buildAllSegments(data);
      // then
      expect(segments.map((s) => s.id)).toEqual(['a']);
    });

    it('should normalize percentages off retained positive rows only', () => {
      // given
      const data: PieDatum[] = [
        { id: 'a', label: 'a', value: 10 },
        { id: 'b', label: 'b', value: -9 },
      ];
      // when
      const segments = buildAllSegments(data);
      // then
      expect(segments).toHaveLength(1);
      expect(segments[0].id).toBe('a');
      expect(segments[0].percent).toBe(100);
    });

    it('should cycle colors when segments exceed palette length', () => {
      // given
      const data: PieDatum[] = Array.from(
        { length: PIE_PALETTE.length + 1 },
        (_, i) => ({ label: `t${i}`, value: PIE_PALETTE.length + 1 - i })
      );
      // when
      const segments = buildAllSegments(data);
      // then
      expect(segments[PIE_PALETTE.length].color).toBe(PIE_PALETTE[0]);
    });

    it('should return empty array for empty/zero data', () => {
      // given / when / then
      expect(buildAllSegments([])).toEqual([]);
      expect(buildAllSegments([{ label: 'a', value: 0 }])).toEqual([]);
    });
  });

  describe('topNIds', () => {
    it('should take the first N segment ids', () => {
      // given
      const segments = buildAllSegments([
        { label: 'a', value: 5 },
        { label: 'b', value: 4 },
        { label: 'c', value: 3 },
      ]);
      // when
      const ids = topNIds(segments, 2);
      // then
      expect([...ids]).toEqual(['a', 'b']);
    });

    it('should default to the top five', () => {
      // given
      const segments = buildAllSegments(
        Array.from({ length: 7 }, (_, i) => ({ label: `t${i}`, value: 7 - i }))
      );
      // when
      const ids = topNIds(segments);
      // then
      expect(ids.size).toBe(5);
    });
  });

  describe('setsEqual', () => {
    it('should be true for same members regardless of order', () => {
      // given / when / then
      expect(setsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    });

    it('should be false on size or member mismatch', () => {
      // given / when / then
      expect(setsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false);
      expect(setsEqual(new Set(['a']), new Set(['b']))).toBe(false);
    });

    it('should treat two empty sets as equal', () => {
      // given / when / then
      expect(setsEqual(new Set(), new Set())).toBe(true);
    });
  });

  describe('selectedTotal', () => {
    it('should sum only selected segment values', () => {
      // given
      const segments = buildAllSegments([
        { label: 'a', value: 100 },
        { label: 'b', value: 60 },
        { label: 'c', value: 40 },
      ]);
      // when
      const total = selectedTotal(segments, new Set(['a', 'c']));
      // then
      expect(total).toBe(140);
    });

    it('should return 0 when nothing is selected', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when / then
      expect(selectedTotal(segments, new Set())).toBe(0);
    });
  });

  describe('buildArcSegments', () => {
    it('should produce one full arc for a single selected slice', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when
      const arcs = buildArcSegments(segments, new Set(['a']));
      // then
      expect(arcs).toHaveLength(1);
      expect(arcs[0].dasharray).toBe('100 0');
      expect(arcs[0].offset).toBe(25);
      expect(arcs[0].percent).toBe(100);
    });

    it('should accumulate offsets across multiple arcs', () => {
      // given
      const segments = buildAllSegments([
        { label: 'a', value: 75 },
        { label: 'b', value: 25 },
      ]);
      // when
      const arcs = buildArcSegments(segments, new Set(['a', 'b']));
      // then
      expect(arcs[0].dasharray).toBe('75 25');
      expect(arcs[0].offset).toBe(25);
      expect(arcs[1].dasharray).toBe('25 75');
      // second arc offset = 25 - first dash (75) = -50
      expect(arcs[1].offset).toBe(-50);
    });

    it('should base percentages on the selected total, not the grand total', () => {
      // given
      const segments = buildAllSegments([
        { label: 'a', value: 100 },
        { label: 'b', value: 100 },
        { label: 'c', value: 200 },
      ]);
      // when — exclude c so a and b each become 50%
      const arcs = buildArcSegments(segments, new Set(['a', 'b']));
      // then
      expect(arcs.map((s) => s.percent)).toEqual([50, 50]);
    });

    it('should return empty when nothing selectable', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when / then
      expect(buildArcSegments(segments, new Set())).toEqual([]);
      expect(buildArcSegments([], new Set(['a']))).toEqual([]);
    });
  });

  describe('percentOfSelected', () => {
    it('should compute the percent of the selected total', () => {
      // given
      const segments = buildAllSegments([
        { label: 'a', value: 100 },
        { label: 'b', value: 100 },
      ]);
      // when
      const pct = percentOfSelected(segments, new Set(['a', 'b']), 'a');
      // then
      expect(pct).toBe(50);
    });

    it('should return null for an unselected id', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when / then
      expect(percentOfSelected(segments, new Set(), 'a')).toBeNull();
    });

    it('should return null when the selected total is zero', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when — id is in the selection set but contributes the only value;
      // force a zero total by selecting a non-existent contributor only.
      const pct = percentOfSelected(segments, new Set(['ghost']), 'ghost');
      // then
      expect(pct).toBeNull();
    });

    it('should return null when the id is missing from segments', () => {
      // given
      const segments = buildAllSegments([{ label: 'a', value: 10 }]);
      // when / then
      expect(percentOfSelected(segments, new Set(['a', 'b']), 'b')).toBeNull();
    });
  });
});
