import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import {
  AI_ASSISTANT_CONFIG,
  isAiAssistantEnabled,
} from './ai-assistant.config';

/**
 * Keeps the CopilotKit chunk (~2.5 MB) unrequested while no AG-UI runtime is
 * configured — `canMatch` runs before the lazy import, unlike `canActivate`.
 */
export const aiAssistantEnabledGuard: CanMatchFn = () =>
  isAiAssistantEnabled(inject(AI_ASSISTANT_CONFIG));
