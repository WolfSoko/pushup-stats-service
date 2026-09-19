import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheerAnimationStore } from './cheer-animation.store';
import { CheerFireworksOverlayComponent } from './cheer-fireworks-overlay.component';

describe('CheerFireworksOverlayComponent', () => {
  const activeCheerFrom = signal<string | null>(null);
  const cheerBackStatus = signal<
    'idle' | 'sending' | 'sent' | 'already' | 'error'
  >('idle');
  const dismiss = vitest.fn();
  const cheerBack = vitest.fn();
  let fixture: ComponentFixture<CheerFireworksOverlayComponent>;

  beforeEach(async () => {
    activeCheerFrom.set(null);
    cheerBackStatus.set('idle');
    dismiss.mockClear();
    cheerBack.mockClear();
    await TestBed.configureTestingModule({
      imports: [CheerFireworksOverlayComponent],
      providers: [
        {
          provide: CheerAnimationStore,
          useValue: { activeCheerFrom, cheerBackStatus, dismiss, cheerBack },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CheerFireworksOverlayComponent);
  });

  it('should render nothing while no cheer is active', () => {
    // when
    fixture.detectChanges();

    // then
    expect(
      fixture.nativeElement.querySelector('[data-testid="cheer-overlay"]')
    ).toBeNull();
  });

  it('should show the fireworks overlay once a cheer is active', () => {
    // given
    activeCheerFrom.set('friend-1');

    // when
    fixture.detectChanges();

    // then
    expect(
      fixture.nativeElement.querySelector('[data-testid="cheer-overlay"]')
    ).toBeTruthy();
  });

  it('should dismiss the animation when the message is tapped', () => {
    // given
    activeCheerFrom.set('friend-1');
    fixture.detectChanges();

    // when
    const button = fixture.nativeElement.querySelector(
      '.cheer-message'
    ) as HTMLButtonElement;
    button.click();

    // then
    expect(dismiss).toHaveBeenCalled();
  });

  describe('cheer-back button', () => {
    function cheerBackButton(): HTMLButtonElement {
      return fixture.nativeElement.querySelector(
        '[data-testid="cheer-back-button"]'
      ) as HTMLButtonElement;
    }

    it('should trigger cheerBack() on the store when tapped', () => {
      // given
      activeCheerFrom.set('friend-1');
      fixture.detectChanges();

      // when
      cheerBackButton().click();

      // then
      expect(cheerBack).toHaveBeenCalled();
    });

    it('should be enabled while idle', () => {
      // given
      activeCheerFrom.set('friend-1');

      // when
      fixture.detectChanges();

      // then
      expect(cheerBackButton().disabled).toBe(false);
    });

    it.each([
      ['sending', true],
      ['sent', true],
      ['already', true],
      ['error', false],
    ] as const)(
      'when the status is "%s" then disabled becomes %s',
      (status, disabled) => {
        // given
        activeCheerFrom.set('friend-1');
        cheerBackStatus.set(status);

        // when
        fixture.detectChanges();

        // then
        expect(cheerBackButton().disabled).toBe(disabled);
      }
    );

    it('should spin the flame icon only while sending', () => {
      // given
      activeCheerFrom.set('friend-1');
      cheerBackStatus.set('sending');

      // when
      fixture.detectChanges();

      // then
      expect(
        cheerBackButton().querySelector('.cheer-back-icon.is-sending')
      ).toBeTruthy();
    });
  });
});
