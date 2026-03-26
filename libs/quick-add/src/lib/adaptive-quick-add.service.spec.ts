import { TestBed } from '@angular/core/testing';
import { AdaptiveQuickAddService } from './adaptive-quick-add.service';
import { PushupRecord } from '@pu-stats/models';

function makeRecord(reps: number): PushupRecord {
  return {
    _id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    reps,
    source: 'test',
  };
}

describe('AdaptiveQuickAddService', () => {
  let service: AdaptiveQuickAddService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdaptiveQuickAddService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('compute()', () => {
    it('returns fallback [1, 5, 10] for empty records', () => {
      expect(service.compute([])).toEqual([1, 5, 10]);
    });

    it('computes 3 suggestions from uniform history', () => {
      // avg = 20: 0.5×20=10, 1×20=20, 1.25×20=25
      const records = Array.from({ length: 5 }, () => makeRecord(20));
      expect(service.compute(records)).toEqual([10, 20, 25]);
    });

    it('rounds suggestions to nearest 5', () => {
      // avg = 12: 0.5×12=6→5, 1×12=12→10, 1.25×12=15→15
      const records = Array.from({ length: 5 }, () => makeRecord(12));
      expect(service.compute(records)).toEqual([5, 10, 15]);
    });

    it('ensures each suggestion is at minimum 1', () => {
      // avg = 1: 0.5×1=0.5→round(0.1)×5=0→max(1,0)=1, 1×1=1→1, 1.25×1=1.25→1
      const records = [makeRecord(1)];
      const result = service.compute(records);
      result.forEach((s) => expect(s).toBeGreaterThanOrEqual(1));
    });

    it('deduplicates suggestions', () => {
      // avg = 4: 0.5×4=2→0×5→max(1,0)=1? No: round(2/5)×5=round(0.4)×5=0×5=0→max(1,0)=1
      // 1×4=4→round(4/5)×5=round(0.8)×5=1×5=5
      // 1.25×4=5→round(5/5)×5=round(1)×5=5
      // suggestions = [1, 5, 5] → deduplicated: [1, 5]
      const records = Array.from({ length: 3 }, () => makeRecord(4));
      const result = service.compute(records);
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });

    it('uses only the last 5 entries from a longer history', () => {
      // First 10 entries with reps=100, last 5 with reps=10
      // avg should be based on last 5 → avg=10
      const old = Array.from({ length: 10 }, () => makeRecord(100));
      const recent = Array.from({ length: 5 }, () => makeRecord(10));
      const result = service.compute([...old, ...recent]);
      // avg=10: 0.5×10=5, 1×10=10, 1.25×10=12.5→round(2.5)×5=3×5=15
      // all three unique → [5, 10, 15]
      expect(result).toEqual([5, 10, 15]);
    });

    it('handles a single entry', () => {
      const records = [makeRecord(40)];
      // avg=40: 0.5×40=20, 1×40=40, 1.25×40=50
      expect(service.compute(records)).toEqual([20, 40, 50]);
    });

    it('rounds fractional averages correctly', () => {
      // 3 records: 10, 15, 20 → avg=15
      // 0.5×15=7.5→round(7.5/5)×5=round(1.5)×5=2×5=10
      // 1×15=15→round(15/5)×5=round(3)×5=15
      // 1.25×15=18.75→round(18.75/5)×5=round(3.75)×5=4×5=20
      const records = [makeRecord(10), makeRecord(15), makeRecord(20)];
      expect(service.compute(records)).toEqual([10, 15, 20]);
    });
  });
});
