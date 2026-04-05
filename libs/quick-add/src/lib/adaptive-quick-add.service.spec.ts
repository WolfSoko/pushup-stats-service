import { TestBed } from '@angular/core/testing';
import { AdaptiveQuickAddService } from './adaptive-quick-add.service';
import { makePushupRecord } from '@pu-stats/testing';

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
    it('Given no records, When compute() is called, Then returns fallback [1, 5, 10]', () => {
      expect(service.compute([])).toEqual([1, 5, 10]);
    });

    it('Given 5 uniform records with 20 reps, When compute() is called, Then returns [10, 20, 25]', () => {
      // avg = 20: 0.5×20=10, 1×20=20, 1.25×20=25
      const records = Array.from({ length: 5 }, () =>
        makePushupRecord({ reps: 20 })
      );
      expect(service.compute(records)).toEqual([10, 20, 25]);
    });

    it('Given 5 uniform records with 12 reps, When compute() is called, Then rounds suggestions to nearest 5 giving [5, 10, 15]', () => {
      // avg = 12: 0.5×12=6→5, 1×12=12→10, 1.25×12=15→15
      const records = Array.from({ length: 5 }, () =>
        makePushupRecord({ reps: 12 })
      );
      expect(service.compute(records)).toEqual([5, 10, 15]);
    });

    it('Given a single record with 1 rep, When compute() is called, Then each suggestion is at minimum 1', () => {
      // avg = 1: 0.5×1=0.5→round(0.1)×5=0→max(1,0)=1, 1×1=1→1, 1.25×1=1.25→1
      const records = [makePushupRecord({ reps: 1 })];
      const result = service.compute(records);
      result.forEach((s) => expect(s).toBeGreaterThanOrEqual(1));
    });

    it('Given records that collapse to fewer than 3 unique values, When compute() is called, Then fills remaining slots by incrementing max by 5', () => {
      // avg = 4: 0.5×4=2→round(2/5)×5=0→max(1,0)=1
      // 1×4=4→round(4/5)×5=1×5=5
      // 1.25×4=5→round(5/5)×5=5
      // raw=[1,5,5] → deduped=[1,5] → padded: max(5)+5=10 → [1,5,10]
      const records = Array.from({ length: 3 }, () =>
        makePushupRecord({ reps: 4 })
      );
      expect(service.compute(records)).toEqual([1, 5, 10]);
    });

    it('Given 15 records (10 old with 100 reps + 5 recent with 10 reps), When compute() is called, Then uses only the last 5 entries giving [5, 10, 15]', () => {
      // First 10 entries with reps=100, last 5 with reps=10
      // avg should be based on last 5 → avg=10
      const old = Array.from({ length: 10 }, () =>
        makePushupRecord({ reps: 100 })
      );
      const recent = Array.from({ length: 5 }, () =>
        makePushupRecord({ reps: 10 })
      );
      const result = service.compute([...old, ...recent]);
      // avg=10: 0.5×10=5, 1×10=10, 1.25×10=12.5→round(2.5)×5=3×5=15
      // all three unique → [5, 10, 15]
      expect(result).toEqual([5, 10, 15]);
    });

    it('Given a single record with 40 reps, When compute() is called, Then returns [20, 40, 50]', () => {
      const records = [makePushupRecord({ reps: 40 })];
      // avg=40: 0.5×40=20, 1×40=40, 1.25×40=50
      expect(service.compute(records)).toEqual([20, 40, 50]);
    });

    it('Given 3 records with 10, 15, 20 reps (avg=15), When compute() is called, Then rounds fractional averages correctly giving [10, 15, 20]', () => {
      // 3 records: 10, 15, 20 → avg=15
      // 0.5×15=7.5→round(7.5/5)×5=round(1.5)×5=2×5=10
      // 1×15=15→round(15/5)×5=round(3)×5=15
      // 1.25×15=18.75→round(18.75/5)×5=round(3.75)×5=4×5=20
      const records = [
        makePushupRecord({ reps: 10 }),
        makePushupRecord({ reps: 15 }),
        makePushupRecord({ reps: 20 }),
      ];
      expect(service.compute(records)).toEqual([10, 15, 20]);
    });
  });
});
