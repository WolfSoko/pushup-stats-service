import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { AdsStore } from './ads.store';

declare global {
  interface Window {
    adsbygoogle: object[];
  }
}

@Component({
  selector: 'lib-ad-slot',
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
        [attr.data-npa]="npa()"
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

  private readonly adsStore = inject(AdsStore);
  readonly usedClient = computed(
    () => this.client() || this.adsStore.adClient()
  );

  enabled = computed(() => this.adsStore.adsAllowed());
  /** Serve non-personalized ads when targeted consent is not given. */
  readonly npa = computed(() =>
    this.adsStore.targetedAdsConsent() ? undefined : '1'
  );
}
