import { TestBed } from '@angular/core/testing';
import type { PublicProfileXp } from '@pu-stats/models';

import { ProfileXpCardComponent } from './profile-xp-card.component';

describe('ProfileXpCardComponent', () => {
  async function render(xp: PublicProfileXp) {
    await TestBed.configureTestingModule({
      imports: [ProfileXpCardComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProfileXpCardComponent);
    fixture.componentRef.setInput('xp', xp);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  function text(host: HTMLElement, selector: string): string {
    return (host.querySelector(selector)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  it('should show the level, the total XP and what is left to the next level', async () => {
    // given — level 3 starts at 300 XP, level 4 at 600
    const host = await render({ total: 450, weekly: 0, monthly: 0 });

    // then
    expect(text(host, '.medal')).toContain('3');
    expect(text(host, '.level')).toBe('Level 3');
    expect(text(host, '[data-testid="public-profile-xp-total"]')).toBe(
      '450 XP'
    );
    expect(text(host, '.remaining')).toBe('Noch 150 XP bis Level 4');
  });

  it('should fill the bar by the progress inside the level', async () => {
    // when
    const host = await render({ total: 450, weekly: 0, monthly: 0 });

    // then
    expect(
      host.querySelector('mat-progress-bar')?.getAttribute('aria-valuenow')
    ).toBe('50');
  });

  it('should show what this week and month earned', async () => {
    // when
    const host = await render({ total: 4659, weekly: 103, monthly: 1227 });

    // then
    expect(text(host, '[data-testid="public-profile-xp-week"] span')).toBe(
      '+103 XP diese Woche'
    );
    expect(text(host, '[data-testid="public-profile-xp-month"] span')).toBe(
      '+1.227 XP diesen Monat'
    );
  });
});
