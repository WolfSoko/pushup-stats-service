import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import {
  CopilotKit,
  CopilotkitAgentFactory,
  provideCopilotKit,
} from '@copilotkit/angular';
import { AppDataFacade } from '../core/app-data.facade';
import { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { AiAssistantPageComponent } from './ai-assistant-page.component';

const appDataMock = {
  dailyGoal: signal(100),
  todayProgress: signal(0),
  remainingToGoal: signal(100),
  goalReached: signal(false),
  dailyGoalBreakdown: signal([]),
} as unknown as AppDataFacade;

const quickAddMock = {
  addSuggestion: vitest.fn(),
} as unknown as QuickAddOrchestrationService;

describe('AiAssistantPageComponent', () => {
  it('should render the chat surface with the configured agent id', async () => {
    // given — mirrors the providers `aiAssistantRoutes` declares, including the
    // re-bound root services CopilotKit needs to resolve its config.
    const view = await render(AiAssistantPageComponent, {
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideCopilotKit({ runtimeUrl: 'https://agent.example.com/api' }),
        CopilotKit,
        CopilotkitAgentFactory,
        {
          provide: AI_ASSISTANT_CONFIG,
          useValue: {
            runtimeUrl: 'https://agent.example.com/api',
            agentId: 'coach',
          },
        },
        { provide: AppDataFacade, useValue: appDataMock },
        { provide: QuickAddOrchestrationService, useValue: quickAddMock },
      ],
    });

    // when
    const host = view.fixture.nativeElement as HTMLElement;

    // then
    expect(screen.getByText('KI-Coach')).toBeTruthy();
    expect(host.querySelector('copilot-chat')).toBeTruthy();
  });

  it('should load the CopilotKit stylesheet on mount', async () => {
    // given / when
    await render(AiAssistantPageComponent, {
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideCopilotKit({ runtimeUrl: 'https://agent.example.com/api' }),
        CopilotKit,
        CopilotkitAgentFactory,
        {
          provide: AI_ASSISTANT_CONFIG,
          useValue: {
            runtimeUrl: 'https://agent.example.com/api',
            agentId: 'default',
          },
        },
        { provide: AppDataFacade, useValue: appDataMock },
        { provide: QuickAddOrchestrationService, useValue: quickAddMock },
      ],
    });

    // then
    expect(
      document.head.querySelector('link[href="assets/copilotkit/styles.css"]')
    ).toBeTruthy();
  });
});
