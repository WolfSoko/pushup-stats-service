import { inject } from '@angular/core';
import type { Routes } from '@angular/router';
import {
  COPILOT_KIT_CONFIG,
  CopilotKit,
  CopilotkitAgentFactory,
  type CopilotKitConfig,
} from '@copilotkit/angular';
import { aiAssistantConfig } from '../../env/ai.config';
import { AiAgentFactory } from './ai-agent.factory';
import { AiAssistantPageComponent } from './ai-assistant-page.component';

/**
 * `CopilotKit` and `CopilotkitAgentFactory` are `providedIn: 'root'` but read
 * `COPILOT_KIT_CONFIG`, which has no root default. Re-declaring them here binds
 * both to this route's injector so the whole CopilotKit surface — ~2.5 MB with
 * katex, highlight.js and the AG-UI client — stays in the lazy chunk instead of
 * being pulled into `app.config.ts`, which nothing tree-shakes away.
 *
 * The config is provided directly rather than through `provideCopilotKit`
 * because the agent has to come out of DI: it needs the Firebase auth handle to
 * sign each request. `provideCopilotKit` only ever wraps this token with a
 * static value (plus CopilotKit-Cloud license headers, which this app has none
 * of), so nothing is lost.
 */
export const aiAssistantRoutes: Routes = [
  {
    path: '',
    providers: [
      {
        provide: COPILOT_KIT_CONFIG,
        useFactory: (): CopilotKitConfig => ({
          agents: {
            [aiAssistantConfig.agentId]: inject(AiAgentFactory).create(),
          },
          properties: { app: 'pushup-stats-service' },
        }),
      },
      CopilotKit,
      CopilotkitAgentFactory,
    ],
    data: {
      seoTitle: $localize`:@@seo.assistant.title:KI-Coach – Pushup Tracker`,
      seoDescription: $localize`:@@seo.assistant.description:Sprich mit deinem KI-Coach: Fortschritt abfragen, Sätze eintragen und durch die App navigieren – über das offene AG-UI-Protokoll.`,
    },
    component: AiAssistantPageComponent,
  },
];
