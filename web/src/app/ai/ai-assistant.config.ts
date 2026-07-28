import { InjectionToken } from '@angular/core';
import { aiAssistantConfig, type AiAssistantConfig } from '../../env/ai.config';

export const AI_ASSISTANT_CONFIG = new InjectionToken<AiAssistantConfig>(
  'AI_ASSISTANT_CONFIG',
  { providedIn: 'root', factory: () => aiAssistantConfig }
);

/** Stylesheet asset copied from `@copilotkit/angular` (see web/project.json). */
export const AI_ASSISTANT_STYLESHEET_HREF = 'assets/copilotkit/styles.css';

export const AI_ASSISTANT_ROUTE = 'assistant';

export function isAiAssistantEnabled(config: AiAssistantConfig): boolean {
  return config.runtimeUrl.trim().length > 0;
}
