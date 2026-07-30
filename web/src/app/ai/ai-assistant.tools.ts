import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { connectAgentContext, registerFrontendTool } from '@copilotkit/angular';
import { z } from 'zod';
import { AppDataFacade } from '../core/app-data.facade';
import { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import {
  buildTrainingSummary,
  loggableExercises,
  logExerciseEntry,
  NAVIGATION_TARGET_IDS,
  NAVIGATION_TARGETS,
} from './ai-assistant-tool-handlers';

/**
 * Registers the app's AG-UI surface: the agent can read the signed-in user's
 * goal progress, log a set, and route the browser. Must run inside an
 * injection context — every registration is torn down with its injector.
 */
export function registerAiAssistantTools(): void {
  const appData = inject(AppDataFacade);
  const quickAdd = inject(QuickAddOrchestrationService);
  const router = inject(Router);

  const summary = computed(() => buildTrainingSummary(appData));

  connectAgentContext(() => ({
    description:
      "Pushup Stats app state: exercises that can be logged and the signed-in user's daily goal progress.",
    value: JSON.stringify({
      exercises: loggableExercises(),
      today: summary(),
    }),
  }));

  registerFrontendTool({
    name: 'logExerciseEntry',
    description:
      'Log a completed set of a rep-based exercise for the signed-in user.',
    parameters: z.object({
      exerciseId: z
        .string()
        .describe('Catalog exercise id, for example "pushup".'),
      reps: z.number().describe('Number of repetitions in the set.'),
    }),
    handler: async ({ exerciseId, reps }) =>
      logExerciseEntry(quickAdd, exerciseId, reps),
  });

  registerFrontendTool({
    name: 'getTrainingSummary',
    description:
      "Read the signed-in user's daily goal and today's training progress.",
    parameters: z.object({}),
    handler: async () => summary(),
  });

  registerFrontendTool({
    name: 'navigateTo',
    description: 'Open one of the app pages in the browser.',
    parameters: z.object({ page: z.enum(NAVIGATION_TARGET_IDS) }),
    handler: async ({ page }) => ({
      ok: await router.navigateByUrl(NAVIGATION_TARGETS[page]),
      page,
    }),
  });
}
