import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AdConsentService } from './ad-consent.service';
import { AdSlotComponent } from './ad-slot.component';
import { AdsConfigService } from './ads-config.service';

describe('AdSlotComponent', () => {
  let fixture: ComponentFixture<AdSlotComponent>;

  const consent = signal(false);
  const consentMock = {
    hasConsent: () => consent(),
  };

  const adsConfigMock = {
    enabled: () => true,
    adClient: () => undefined,
  };

  beforeEach(async () => {
    consent.set(false);

    await TestBed.configureTestingModule({
      imports: [AdSlotComponent],
      providers: [
        { provide: AdConsentService, useValue: consentMock },
        { provide: AdsConfigService, useValue: adsConfigMock },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdSlotComponent);
    fixture.componentRef.setInput('client', 'ca-pub-123');
    fixture.componentRef.setInput('slot', '1234567890');
  });

  it('initializes and renders ad slot when consent is granted', async () => {
    consent.set(true);
    fixture.detectChanges();

    await fixture.whenStable();

    expect(fixture.debugElement.query(By.css('ins'))).toBeTruthy();
  });
});
