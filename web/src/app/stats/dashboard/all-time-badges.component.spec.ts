import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';

import { AllTimeBadgesComponent } from './all-time-badges.component';

describe('AllTimeBadgesComponent', () => {
  async function render() {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AllTimeBadgesComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AllTimeBadgesComponent);
    fixture.componentRef.setInput('total', 1200);
    fixture.componentRef.setInput('days', 30);
    fixture.componentRef.setInput('entries', 90);
    fixture.componentRef.setInput('avg', '40.0');
    fixture.detectChanges();
    return fixture;
  }

  function tooltips(
    fixture: Awaited<ReturnType<typeof render>>
  ): ReadonlyArray<string> {
    return fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map((el) => el.injector.get(MatTooltip).message);
  }

  it('should name the exercise the numbers belong to', async () => {
    // given — the badges aggregate push-ups only, while the page below
    // them lists sit-ups, planks and runs
    const fixture = await render();

    // then
    expect(fixture.nativeElement.textContent).toContain('Liegestütze');
  });

  it('should explain what every badge counts', async () => {
    // given — four bare numbers in a row say nothing about their own
    // arithmetic
    const fixture = await render();

    // then
    const messages = tooltips(fixture);
    expect(messages.length).toBe(4);
    for (const message of messages) {
      expect(message).toContain('Liegestütz');
    }
  });

  it('should say how the average is calculated', async () => {
    // given — the one badge whose number cannot be checked by eye
    const fixture = await render();

    // then
    expect(tooltips(fixture).at(-1)).toContain('geteilt durch');
  });

  it('should render the four values it was given', async () => {
    // given
    const fixture = await render();

    // then
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1200');
    expect(text).toContain('30');
    expect(text).toContain('90');
    expect(text).toContain('40.0');
  });

  it('should still link to the analysis page', async () => {
    // given
    const fixture = await render();

    // then
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="dashboard-all-time-badges-link"]')
        .getAttribute('href')
    ).toContain('/analysis');
  });
});
