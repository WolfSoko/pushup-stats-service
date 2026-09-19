import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheerAnimationStore } from './cheer-animation.store';
import { CheerFireworksOverlayComponent } from './cheer-fireworks-overlay.component';

describe('CheerFireworksOverlayComponent', () => {
  const activeCheerFrom = signal<string | null>(null);
  const dismiss = vitest.fn();
  let fixture: ComponentFixture<CheerFireworksOverlayComponent>;

  beforeEach(async () => {
    activeCheerFrom.set(null);
    dismiss.mockClear();
    await TestBed.configureTestingModule({
      imports: [CheerFireworksOverlayComponent],
      providers: [
        {
          provide: CheerAnimationStore,
          useValue: { activeCheerFrom, dismiss },
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
});
