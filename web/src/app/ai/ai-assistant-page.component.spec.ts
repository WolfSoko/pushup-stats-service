import { provideZonelessChangeDetection, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import {
  CopilotChat,
  CopilotKit,
  CopilotkitAgentFactory,
  provideCopilotKit,
} from '@copilotkit/angular';
import { AppDataFacade } from '../core/app-data.facade';
import { QuickAddOrchestrationService } from '../core/quick-add-orchestration.service';
import {
  AI_ASSISTANT_CONFIG,
  AI_ASSISTANT_STYLESHEET_HREF,
} from './ai-assistant.config';
import { AiAssistantPageComponent } from './ai-assistant-page.component';

const RUNTIME_URL = 'https://agent.example.com/api/copilotkit';

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

function stylesheetLinks(): NodeListOf<HTMLLinkElement> {
  return document.head.querySelectorAll<HTMLLinkElement>(
    `link[href="${AI_ASSISTANT_STYLESHEET_HREF}"]`
  );
}

// Mirrors the providers `aiAssistantRoutes` declares, including the re-bound
// root services CopilotKit needs to resolve its config outside the root
// injector. Without them the render fails with NullInjectorError.
function renderPage(agentId: string) {
  return render(AiAssistantPageComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideCopilotKit({ runtimeUrl: RUNTIME_URL }),
      CopilotKit,
      CopilotkitAgentFactory,
      {
        provide: AI_ASSISTANT_CONFIG,
        useValue: { runtimeUrl: RUNTIME_URL, agentId },
      },
      { provide: AppDataFacade, useValue: appDataMock },
      { provide: QuickAddOrchestrationService, useValue: quickAddMock },
    ],
  });
}

describe('AiAssistantPageComponent', () => {
  // The jsdom document is shared across spec files, so a leaked <link> would
  // silently turn AiAssistantStylesService's insertion test into a
  // deduplication test.
  beforeEach(() => {
    stylesheetLinks().forEach((link) => link.remove());
  });

  afterEach(() => {
    stylesheetLinks().forEach((link) => link.remove());
  });

  it('should render the chat surface bound to the configured agent id', async () => {
    // given / when
    const view = await renderPage('coach');

    // then
    expect(screen.getByText('KI-Coach')).toBeTruthy();
    const chat = view.fixture.debugElement.query(By.directive(CopilotChat));
    expect(chat).toBeTruthy();
    expect((chat.componentInstance as CopilotChat).agentId()).toBe('coach');
  });

  it('should load the CopilotKit stylesheet on mount', async () => {
    // given
    expect(stylesheetLinks().length).toBe(0);

    // when
    await renderPage('default');

    // then
    expect(stylesheetLinks().length).toBe(1);
    expect(stylesheetLinks()[0].rel).toBe('stylesheet');
  });

  it('should surface the pending handshake while the runtime connects', async () => {
    // given / when
    await renderPage('default');

    // then — the terminal/unavailable copy is reserved for `error` and
    // `disconnected`; see ai-assistant-status.spec.ts for the full mapping.
    expect(
      screen.getByText('Verbindung zum Agenten wird aufgebaut …')
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Kein Agent erreichbar. Prüfe die konfigurierte AG-UI-Runtime.'
      )
    ).toBeNull();
  });
});
