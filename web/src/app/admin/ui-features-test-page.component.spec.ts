import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { AchievementCelebrationService } from '../achievements/achievement-celebration.service';
import { CheerAnimationStore } from '../core/cheer-animation.store';
import { UiFeaturesTestPageComponent } from './ui-features-test-page.component';

describe('UiFeaturesTestPageComponent', () => {
  let fixture: ComponentFixture<UiFeaturesTestPageComponent>;
  const play = vitest.fn();
  const preview = vitest.fn();

  beforeEach(async () => {
    play.mockClear();
    preview.mockClear();
    await TestBed.configureTestingModule({
      imports: [UiFeaturesTestPageComponent],
      providers: [
        provideRouter([]),
        { provide: CheerAnimationStore, useValue: { play } },
        { provide: AchievementCelebrationService, useValue: { preview } },
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

  it('should preview the first plan-day badge by default', () => {
    // given
    const button = fixture.nativeElement.querySelector(
      '[data-testid="preview-badge-dialog"]'
    ) as HTMLButtonElement;

    // when
    button.click();

    // then
    expect(preview).toHaveBeenCalledWith('plan-days-1');
  });

  it('should preview the badge picked in the select', async () => {
    // given
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const select = await loader.getHarness(
      MatSelectHarness.with({
        selector: '[data-testid="preview-badge-select"]',
      })
    );
    await select.open();
    const options = await select.getOptions();
    expect(options.length).toBe(9);
    await select.clickOptions({ text: 'Trainingsplan abgeschlossen' });

    // when
    (
      fixture.nativeElement.querySelector(
        '[data-testid="preview-badge-dialog"]'
      ) as HTMLButtonElement
    ).click();

    // then
    expect(preview).toHaveBeenCalledWith('plan-completed-preview');
  });
});
