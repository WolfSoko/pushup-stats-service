import type { Routes } from '@angular/router';
import {
  CopilotKit,
  CopilotkitAgentFactory,
  provideCopilotKit,
} from '@copilotkit/angular';
import { aiAssistantConfig } from '../../env/ai.config';
import { resolveRuntimeUrl } from './ai-assistant.config';
import { AiAssistantPageComponent } from './ai-assistant-page.component';

/**
 * `CopilotKit` and `CopilotkitAgentFactory` are `providedIn: 'root'` but read
 * `COPILOT_KIT_CONFIG`, which has no root default. Re-declaring them here binds
 * both to this route's injector so the whole CopilotKit surface — ~2.5 MB with
 * katex, highlight.js and the AG-UI client — stays in the lazy chunk instead of
 * being pulled into `app.config.ts`, which nothing tree-shakes away.
 */
export const aiAssistantRoutes: Routes = [
  {
    path: '',
    providers: [
      provideCopilotKit({
        runtimeUrl: resolveRuntimeUrl(aiAssistantConfig),
        properties: { app: 'pushup-stats-service' },
      }),
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
