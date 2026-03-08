import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  inject,
} from '@angular/core';
import { AdConsentService } from './ad-consent.service';
import { GoogleAdsService } from './google-ads.service';

@Component({
  selector: 'app-ad-slot',
  imports: [CommonModule],
  template: `
    @if (enabled) {
      <ins
        #slotRef
        class="adsbygoogle"
        [style.display]="'block'"
        [attr.data-ad-client]="client"
        [attr.data-ad-slot]="slot"
        [attr.data-ad-format]="format"
        [attr.data-full-width-responsive]="responsive ? 'true' : 'false'"
      ></ins>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent implements AfterViewInit {
  private readonly consent = inject(AdConsentService);
  private readonly ads = inject(GoogleAdsService);

  @Input({ required: true }) client!: string;
  @Input({ required: true }) slot!: string;
  @Input() format = 'auto';
  @Input() responsive = true;

  @ViewChild('slotRef') private slotRef?: ElementRef<HTMLElement>;

  get enabled(): boolean {
    return this.consent.hasConsent();
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.enabled) return;
    await this.ads.initialize(this.client);
    const host = this.slotRef?.nativeElement;
    if (!host) return;
    this.ads.renderSlot(host);
  }
}
