import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { AdConsentService } from './ad-consent.service';
import { AdsConfigService } from './ads-config.service';

declare global {
  interface Window {
    adsbygoogle: object[];
  }
}

@Component({
  selector: 'app-ad-slot',
  imports: [CommonModule],
  template: `
    @if (enabled()) {
      <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={{
          usedClient()
        }}"
        crossorigin="anonymous"
      ></script>
      <ins
        #slotRef
        class="adsbygoogle"
        [style.display]="'block'"
        [attr.data-ad-client]="usedClient()"
        [attr.data-ad-slot]="slot()"
        [attr.data-ad-format]="format()"
        [attr.data-full-width-responsive]="responsive() ? 'true' : 'false'"
      ></ins>
      <script>
        (adsbygoogle = window.adsbygoogle || []).push({});
      </script>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSlotComponent {
  readonly slot = input.required();
  readonly format = input('auto');
  readonly responsive = input<boolean>(true);
  readonly client = input<string>();

  private readonly consent = inject(AdConsentService);
  private readonly adsConfig = inject(AdsConfigService);
  readonly usedClient = computed(
    () => this.client || this.adsConfig.adClient()
  );

  enabled = computed(() => {
    return this.consent.hasConsent() && this.adsConfig.enabled();
  });
}
