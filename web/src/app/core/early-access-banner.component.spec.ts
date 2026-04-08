import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EarlyAccessBannerComponent } from './early-access-banner.component';

describe('EarlyAccessBannerComponent', () => {
  let fixture: ComponentFixture<EarlyAccessBannerComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [EarlyAccessBannerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EarlyAccessBannerComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the banner by default', () => {
    const banner = fixture.nativeElement.querySelector('.early-access-banner');
    expect(banner).toBeTruthy();
  });

  it('contains the early access text', () => {
    const text = fixture.nativeElement.querySelector(
      '.early-access-banner__text span'
    );
    expect(text.textContent).toContain('Early Access');
  });

  it('has a dismiss button', () => {
    const button = fixture.nativeElement.querySelector(
      'button[mat-icon-button]'
    );
    expect(button).toBeTruthy();
  });

  it('hides the banner after dismiss', () => {
    const button = fixture.nativeElement.querySelector(
      'button[mat-icon-button]'
    );
    button.click();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.early-access-banner');
    expect(banner).toBeFalsy();
  });

  it('persists dismissal in localStorage', () => {
    const button = fixture.nativeElement.querySelector(
      'button[mat-icon-button]'
    );
    button.click();

    expect(localStorage.getItem('pus_early_access_dismissed')).toBe('1');
  });

  it('stays hidden when previously dismissed', async () => {
    localStorage.setItem('pus_early_access_dismissed', '1');

    const freshFixture = TestBed.createComponent(EarlyAccessBannerComponent);
    freshFixture.detectChanges();

    const banner = freshFixture.nativeElement.querySelector(
      '.early-access-banner'
    );
    expect(banner).toBeFalsy();
  });
});
