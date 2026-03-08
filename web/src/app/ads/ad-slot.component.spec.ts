import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdSlotComponent } from './ad-slot.component';
import { AdConsentService } from './ad-consent.service';
import { GoogleAdsService } from './google-ads.service';

describe('AdSlotComponent', () => {
  let fixture: ComponentFixture<AdSlotComponent>;

  const consent = signal(false);
  const consentMock = {
    hasConsent: () => consent(),
  };

  const adsMock = {
    initialize: vitest.fn().mockResolvedValue(undefined),
    renderSlot: vitest.fn(),
  };

  beforeEach(async () => {
    vitest.clearAllMocks();
    consent.set(false);

    await TestBed.configureTestingModule({
      imports: [AdSlotComponent],
      providers: [
        { provide: AdConsentService, useValue: consentMock },
        { provide: GoogleAdsService, useValue: adsMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdSlotComponent);
    fixture.componentInstance.client = 'ca-pub-123';
    fixture.componentInstance.slot = '1234567890';
  });

  it('does not initialize ads without consent', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(adsMock.initialize).not.toHaveBeenCalled();
    expect(adsMock.renderSlot).not.toHaveBeenCalled();
  });

  it('initializes and renders ad slot when consent is granted', async () => {
    consent.set(true);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(adsMock.initialize).toHaveBeenCalledWith('ca-pub-123');
    expect(adsMock.renderSlot).toHaveBeenCalled();
  });
});
