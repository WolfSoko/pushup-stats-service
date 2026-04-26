import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

// Hoisted shared spy so the module mock and the test code reference the same
// function instance (vi.mock factories can't close over module-scope vars).
const mocks = vi.hoisted(() => ({
  vaporizeSpy: vi.fn<(el: HTMLElement) => unknown>(),
  capturedOptions: { last: null as Record<string, unknown> | null },
}));

// Replace the real package (which has unresolved missing-extension imports
// under Node ESM) with stubs that wire into the hoisted spy. The dialog
// constructs WsThanosService via a child environment injector, so the mock
// class — not a TestBed `useValue` — is what actually runs `.vaporize`.
vi.mock('@wolsok/thanos', async () => {
  const { InjectionToken } = await import('@angular/core');
  class WsThanosService {
    vaporize(el: HTMLElement): unknown {
      return mocks.vaporizeSpy(el);
    }
  }
  return {
    WsThanosService,
    WS_THANOS_OPTIONS_TOKEN: new InjectionToken('WS_THANOS_OPTIONS_TOKEN'),
    createWsThanosOptions: (opts?: Record<string, unknown>) => {
      const merged = {
        animationLength: 5000,
        maxParticleCount: 200_000,
        particleAcceleration: 30,
        ...(opts ?? {}),
      };
      mocks.capturedOptions.last = merged;
      return merged;
    },
  };
});

import {
  GoalReachedDialogComponent,
  GoalReachedDialogData,
} from './goal-reached-dialog.component';

describe('GoalReachedDialogComponent', () => {
  let fixture: ComponentFixture<GoalReachedDialogComponent>;
  const closeSpy = vitest.fn();
  let vaporizeSubject: Subject<unknown>;
  const vaporizeSpy = mocks.vaporizeSpy;

  async function setup(data: GoalReachedDialogData): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GoalReachedDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: closeSpy } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalReachedDialogComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vaporizeSubject = new Subject<unknown>();
    vitest.clearAllMocks();
    mocks.capturedOptions.last = null;
    mocks.vaporizeSpy.mockReset();
    mocks.vaporizeSpy.mockImplementation(() => vaporizeSubject.asObservable());
  });

  describe('Given the dialog renders for a daily goal', () => {
    it('Then it shows the daily title, progress total/goal, and snap button', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 100,
        goal: 100,
        titleId: 'test-title-1',
      });

      // When
      const text = fixture.nativeElement.textContent ?? '';

      // Then
      expect(text).toContain('Tagesziel erreicht!');
      expect(text).toContain('100 / 100');
      expect(
        fixture.nativeElement.querySelector('[data-testid="goal-reached-snap"]')
      ).toBeTruthy();
    });

    it('Then the title h2 carries the caller-supplied id for ariaLabelledBy', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 100,
        goal: 100,
        titleId: 'unique-id-42',
      });

      // Then
      const title = fixture.nativeElement.querySelector('h2.title');
      expect(title?.getAttribute('id')).toBe('unique-id-42');
    });
  });

  describe('Given the dialog renders for a weekly goal', () => {
    it('Then it shows the weekly title and progress', async () => {
      // Given
      await setup({
        kind: 'weekly',
        total: 540,
        goal: 500,
        titleId: 'test-title-2',
      });

      // When
      const text = fixture.nativeElement.textContent ?? '';

      // Then
      expect(text).toContain('Wochenziel erreicht!');
      expect(text).toContain('540 / 500');
    });
  });

  describe('Given the dialog renders for a monthly goal', () => {
    it('Then it shows the monthly title and progress', async () => {
      // Given
      await setup({
        kind: 'monthly',
        total: 2200,
        goal: 2000,
        titleId: 'test-title-3',
      });

      // When
      const text = fixture.nativeElement.textContent ?? '';

      // Then
      expect(text).toContain('Monatsziel erreicht!');
      expect(text).toContain('2200 / 2000');
    });
  });

  describe('Given the user clicks Snap', () => {
    it('Then it lazy-vaporizes the card element and closes the dialog on completion', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-4',
      });
      const card = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-card"]'
      ) as HTMLElement;
      const snapBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-snap"]'
      ) as HTMLButtonElement;

      // When
      snapBtn.click();
      await fixture.whenStable();

      // Then — vaporize called with the card element
      expect(vaporizeSpy).toHaveBeenCalledTimes(1);
      expect(vaporizeSpy).toHaveBeenCalledWith(card);
      expect(closeSpy).not.toHaveBeenCalled();

      // When the animation completes
      vaporizeSubject.complete();

      // Then the dialog closes
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('Then it ignores rapid double-clicks (only one vaporize)', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-4',
      });
      const snapBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-snap"]'
      ) as HTMLButtonElement;

      // When
      snapBtn.click();
      snapBtn.click();
      await fixture.whenStable();

      // Then
      expect(vaporizeSpy).toHaveBeenCalledTimes(1);
    });

    it('Then it still closes the dialog if vaporize emits an error', async () => {
      // Given — html2canvas can throw on modern CSS color() functions
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-4',
      });
      const snapBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-snap"]'
      ) as HTMLButtonElement;

      // When
      snapBtn.click();
      await fixture.whenStable();
      vaporizeSubject.error(new Error('Unsupported color function "color"'));

      // Then
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given dialog data carries a maxParticleCount override', () => {
    it('Then it forwards that count into the WsThanosOptions factory on snap', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-particles',
        maxParticleCount: 40_000,
      });
      const snapBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-snap"]'
      ) as HTMLButtonElement;

      // When
      snapBtn.click();
      await fixture.whenStable();

      // Then
      expect(mocks.capturedOptions.last).toEqual(
        expect.objectContaining({ maxParticleCount: 40_000 })
      );
    });

    it('Then it falls back to the high preset when the override is omitted', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-particles-default',
      });
      const snapBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-snap"]'
      ) as HTMLButtonElement;

      // When
      snapBtn.click();
      await fixture.whenStable();

      // Then
      expect(mocks.capturedOptions.last).toEqual(
        expect.objectContaining({ maxParticleCount: 200_000 })
      );
    });
  });

  describe('Given the user clicks the close button', () => {
    it('Then it closes the dialog without vaporizing', async () => {
      // Given
      await setup({
        kind: 'daily',
        total: 50,
        goal: 50,
        titleId: 'test-title-close',
      });
      const closeBtn = fixture.nativeElement.querySelector(
        '[data-testid="goal-reached-close"]'
      ) as HTMLButtonElement;

      // When
      closeBtn.click();
      await fixture.whenStable();

      // Then
      expect(vaporizeSpy).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
