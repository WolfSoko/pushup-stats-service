import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { AI_ASSISTANT_STYLESHEET_HREF } from './ai-assistant.config';

/**
 * Pulls the CopilotKit stylesheet in at runtime instead of via `styleUrl` or
 * the global `styles` array. It is ~76 kB — a third of the app's initial
 * payload — for a feature that is off unless a runtime URL is configured, and
 * it blows the 16 kB `anyComponentStyle` budget when attached to a component.
 * Shipping it as a plain asset keeps it out of both budgets and off the
 * critical path.
 */
@Injectable()
export class AiAssistantStylesService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  load(): void {
    if (!this.isBrowser) return;
    const selector = `link[href="${AI_ASSISTANT_STYLESHEET_HREF}"]`;
    if (this.document.head.querySelector(selector)) return;

    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = AI_ASSISTANT_STYLESHEET_HREF;
    this.document.head.appendChild(link);
  }
}
