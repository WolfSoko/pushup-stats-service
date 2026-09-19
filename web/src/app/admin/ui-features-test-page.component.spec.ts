import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CheerAnimationStore } from '../core/cheer-animation.store';
import { UiFeaturesTestPageComponent } from './ui-features-test-page.component';

describe('UiFeaturesTestPageComponent', () => {
  let fixture: ComponentFixture<UiFeaturesTestPageComponent>;
  const play = vitest.fn();

  beforeEach(async () => {
    play.mockClear();
    await TestBed.configureTestingModule({
      imports: [UiFeaturesTestPageComponent],
      providers: [
        provideRouter([]),
        { provide: CheerAnimationStore, useValue: { play } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UiFeaturesTestPageComponent);
    fixture.detectChanges();
  });

  it('should trigger the cheer animation preview when the button is clicked', () => {
    // given
    const button = fixture.nativeElement.querySelector(
      '[data-testid="preview-cheer-animation"]'
    ) as HTMLButtonElement;

    // when
    button.click();

    // then
    expect(play).toHaveBeenCalledWith(expect.any(String));
  });
});
