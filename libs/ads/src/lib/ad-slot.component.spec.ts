import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AdSlotComponent } from './ad-slot.component';
import { AdsStore } from './ads.store';

describe('AdSlotComponent', () => {
  let fixture: ComponentFixture<AdSlotComponent>;

  const adsStoreMock = {
    enabled: () => true,
    adClient: () => undefined,
    targetedAdsConsent: () => true,
    adsAllowed: () => true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdSlotComponent],
      providers: [{ provide: AdsStore, useValue: adsStoreMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdSlotComponent);
    fixture.componentRef.setInput('client', 'ca-pub-123');
    fixture.componentRef.setInput('slot', '1234567890');
  });

  it('initializes and renders ad slot when ads are enabled', async () => {
    fixture.detectChanges();

    await fixture.whenStable();

    expect(fixture.debugElement.query(By.css('ins'))).toBeTruthy();
  });

  it('does not set data-npa when targeted consent is given', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const ins = fixture.debugElement.query(By.css('ins'));
    expect(ins.nativeElement.getAttribute('data-npa')).toBeNull();
  });
});

describe('AdSlotComponent (non-personalized)', () => {
  let fixture: ComponentFixture<AdSlotComponent>;

  const npaStoreMock = {
    enabled: () => true,
    adClient: () => undefined,
    targetedAdsConsent: () => false,
    adsAllowed: () => true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdSlotComponent],
      providers: [{ provide: AdsStore, useValue: npaStoreMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdSlotComponent);
    fixture.componentRef.setInput('client', 'ca-pub-123');
    fixture.componentRef.setInput('slot', '1234567890');
  });

  it('sets data-npa="1" when targeted consent is not given', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const ins = fixture.debugElement.query(By.css('ins'));
    expect(ins.nativeElement.getAttribute('data-npa')).toBe('1');
  });
});
