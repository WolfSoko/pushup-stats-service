import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  AI_ASSISTANT_CONFIG,
  AI_ASSISTANT_ROUTE,
  isAiAssistantEnabled,
} from './ai-assistant.config';

/**
 * Eager toolbar entry point. Deliberately free of `@copilotkit/angular`
 * imports — the library only loads once the route is visited.
 */
@Component({
  selector: 'app-ai-assistant-nav-button',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enabled) {
      <a
        mat-icon-button
        [routerLink]="routerLink"
        aria-label="KI-Coach öffnen"
        i18n-aria-label="@@nav.assistant"
        data-testid="ai-assistant-nav-button"
      >
        <mat-icon>smart_toy</mat-icon>
      </a>
    }
  `,
})
export class AiAssistantNavButtonComponent {
  protected readonly enabled = isAiAssistantEnabled(
    inject(AI_ASSISTANT_CONFIG)
  );
  protected readonly routerLink = `/${AI_ASSISTANT_ROUTE}`;
}
