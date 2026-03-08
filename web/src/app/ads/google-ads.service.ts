import { Injectable } from '@angular/core';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAdsService {
  private initializedForClient = new Set<string>();

  async initialize(client: string): Promise<void> {
    if (!client || this.initializedForClient.has(client)) return;

    const existing = document.querySelector<HTMLScriptElement>(
      'script#data-ads-client'
    );
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
        client
      )}`;
      script.crossOrigin = 'anonymous';
      script.id = 'data-ads-client';
      document.head.appendChild(script);
    }

    this.initializedForClient.add(client);
  }

  renderSlot(host: HTMLElement): void {
    if (!host) return;
    const w = window as Window;
    w.adsbygoogle = w.adsbygoogle || [];
    w.adsbygoogle.push({});
  }
}
