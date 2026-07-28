import { InjectionToken } from '@angular/core';
import { aiAssistantConfig, type AiAssistantConfig } from '../../env/ai.config';

export const AI_ASSISTANT_CONFIG = new InjectionToken<AiAssistantConfig>(
  'AI_ASSISTANT_CONFIG',
  { providedIn: 'root', factory: () => aiAssistantConfig }
);

/** Stylesheet asset copied from `@copilotkit/angular` (see web/project.json). */
export const AI_ASSISTANT_STYLESHEET_HREF = 'assets/copilotkit/styles.css';

export const AI_ASSISTANT_ROUTE = 'assistant';

/**
 * CopilotKit strips a trailing slash but not surrounding whitespace, so a
 * padded value in `ai.config.ts` would reach `fetch` verbatim. Trim once here
 * and let every consumer read the runtime URL through this function.
 */
export function resolveRuntimeUrl(config: AiAssistantConfig): string {
  return config.runtimeUrl.trim();
}

export function isAiAssistantEnabled(config: AiAssistantConfig): boolean {
  return resolveRuntimeUrl(config).length > 0;
}
