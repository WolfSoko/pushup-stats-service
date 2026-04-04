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
});
