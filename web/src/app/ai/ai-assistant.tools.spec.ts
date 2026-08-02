import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpAgent } from '@ag-ui/client';
import {
  COPILOT_KIT_CONFIG,
  CopilotKit,
  CopilotkitAgentFactory,
  type FrontendToolConfig,
} from '@copilotkit/angular';
import { AppDataFacade } from '../core/app-data.facade';
import { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import { NAVIGATION_TARGETS } from './ai-assistant-tool-handlers';
import { registerAiAssistantTools } from './ai-assistant.tools';

type AnyToolConfig = FrontendToolConfig<Record<string, never>>;

const appDataMock = {
  dailyGoal: signal(100),
  todayProgress: signal(42),
  remainingToGoal: signal(58),
  goalReached: signal(false),
  dailyGoalBreakdown: signal([]),
} as unknown as AppDataFacade;

interface Harness {
  readonly tools: AnyToolConfig[];
  readonly contexts: { description: string; value: string }[];
  readonly navigateByUrl: ReturnType<typeof vitest.fn>;
}

/**
 * Spies on the `CopilotKit` service rather than mocking the
 * `@copilotkit/angular` module: `registerFrontendTool` and
 * `connectAgentContext` funnel into `addFrontendTool` / `core.addContext`, and
 * module-level mocks leak across the shared Vitest registry in this project.
 */
function setup(): Harness {
  const navigateByUrl = vitest.fn().mockResolvedValue(true);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: COPILOT_KIT_CONFIG,
        useValue: {
          agents: {
            default: new HttpAgent({
              url: 'https://agent.example.com/agUiAgent',
            }),
          },
        },
      },
      CopilotKit,
      CopilotkitAgentFactory,
      { provide: AppDataFacade, useValue: appDataMock },
      {
        provide: QuickAddOrchestrationService,
        useValue: { addSuggestion: vitest.fn() },
      },
      { provide: Router, useValue: { navigateByUrl } },
    ],
  });

  const copilotKit = TestBed.inject(CopilotKit);
  const tools: AnyToolConfig[] = [];
  const contexts: { description: string; value: string }[] = [];

  vitest
    .spyOn(copilotKit, 'addFrontendTool')
    .mockImplementation(
      (config) => void tools.push(config as unknown as AnyToolConfig)
    );
  vitest.spyOn(copilotKit.core, 'addContext').mockImplementation((context) => {
    contexts.push(context as { description: string; value: string });
    return 'context-id';
  });

  TestBed.runInInjectionContext(() => registerAiAssistantTools());
  TestBed.tick();

  return { tools, contexts, navigateByUrl };
}

function tool(harness: Harness, name: string): AnyToolConfig {
  const match = harness.tools.find((config) => config.name === name);
  if (!match) throw new Error(`Tool "${name}" was never registered`);
  return match;
}

describe('registerAiAssistantTools', () => {
  it('should register the three frontend tools the agent may call', () => {
    // given / when
    const harness = setup();

    // then
    expect(harness.tools.map((config) => config.name)).toEqual([
      'logExerciseEntry',
      'getTrainingSummary',
      'navigateTo',
    ]);
  });

  it('should accept a well-formed logExerciseEntry payload', () => {
    // given
    const harness = setup();

    // when
    const parsed = tool(harness, 'logExerciseEntry').parameters[
      '~standard'
    ].validate({ exerciseId: 'pushup', reps: 20 });

    // then
    expect(parsed).toEqual({ value: { exerciseId: 'pushup', reps: 20 } });
  });

  it('should reject a logExerciseEntry payload with a non-numeric rep count', () => {
    // given
    const harness = setup();

    // when
    const parsed = tool(harness, 'logExerciseEntry').parameters[
      '~standard'
    ].validate({ exerciseId: 'pushup', reps: 'zwanzig' });

    // then
    expect('issues' in parsed && (parsed.issues?.length ?? 0) > 0).toBe(true);
  });

  it('should map every navigateTo page onto its in-app path', async () => {
    // given
    const harness = setup();
    const navigateTo = tool(harness, 'navigateTo');

    // when
    for (const page of Object.keys(NAVIGATION_TARGETS)) {
      await navigateTo.handler({ page } as never, {} as never);
    }

    // then
    expect(harness.navigateByUrl.mock.calls.map(([url]) => url)).toEqual(
      Object.values(NAVIGATION_TARGETS)
    );
  });

  it('should answer getTrainingSummary from the app data facade', async () => {
    // given
    const harness = setup();

    // when
    const summary = await tool(harness, 'getTrainingSummary').handler(
      {} as never,
      {} as never
    );

    // then
    expect(summary).toMatchObject({
      dailyGoal: 100,
      todayProgress: 42,
      remainingToGoal: 58,
      goalReached: false,
    });
  });

  it('should publish the loggable exercises and goal progress as agent context', () => {
    // given
    const harness = setup();

    // when
    const payload = JSON.parse(harness.contexts[0].value);

    // then
    expect(payload.exercises).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'pushup' })])
    );
    expect(payload.today.todayProgress).toBe(42);
  });
});
