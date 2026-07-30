import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CopilotChat, CopilotKit } from '@copilotkit/angular';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { toAiAssistantStatus } from './ai-assistant-status';
import { AiAssistantStylesService } from './ai-assistant-styles.service';
import { registerAiAssistantTools } from './ai-assistant.tools';

@Component({
  selector: 'app-ai-assistant-page',
  imports: [CopilotChat, MatIconModule],
  providers: [AiAssistantStylesService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assistant">
      <header class="assistant-intro">
        <mat-icon aria-hidden="true">smart_toy</mat-icon>
        <div>
          <h1 i18n="@@assistant.title">KI-Coach</h1>
          <p i18n="@@assistant.subtitle">
            Frag nach deinem Fortschritt, lass Sätze eintragen oder dich durch
            die App navigieren. Der Assistent spricht über das offene
            AG-UI-Protokoll mit dem konfigurierten Agenten.
          </p>
        </div>
      </header>

      @if (status() === 'connecting') {
        <p class="assistant-status" role="status" i18n="@@assistant.connecting">
          Verbindung zum Agenten wird aufgebaut …
        </p>
      } @else if (status() === 'unavailable') {
        <p
          class="assistant-status"
          role="status"
          i18n="@@assistant.unavailable"
        >
          Kein Agent erreichbar. Prüfe die konfigurierte AG-UI-Runtime.
        </p>
      }

      <copilot-chat class="assistant-chat" [agentId]="agentId" />
    </section>
  `,
  styles: `
    .assistant {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 60rem;
      margin: 0 auto;
      padding: 1rem;
      min-height: 70vh;
    }

    .assistant-intro {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }

    .assistant-intro h1 {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
    }

    .assistant-intro p {
      margin: 0;
      opacity: 0.8;
    }

    .assistant-status {
      margin: 0;
      opacity: 0.7;
    }

    .assistant-chat {
      flex: 1 1 auto;
      min-height: 0;
    }
  `,
})
export class AiAssistantPageComponent {
  private readonly copilotKit = inject(CopilotKit);
  private readonly config = inject(AI_ASSISTANT_CONFIG);

  protected readonly agentId = this.config.agentId;
  protected readonly status = computed(() =>
    toAiAssistantStatus(`${this.copilotKit.runtimeConnectionStatus()}`)
  );

  constructor() {
    inject(AiAssistantStylesService).load();
    registerAiAssistantTools();
  }
}
