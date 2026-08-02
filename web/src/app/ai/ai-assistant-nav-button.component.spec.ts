import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { AI_ASSISTANT_CONFIG } from './ai-assistant.config';
import { AiAssistantNavButtonComponent } from './ai-assistant-nav-button.component';

async function renderNavButton(agentUrl: string): Promise<void> {
  await render(AiAssistantNavButtonComponent, {
    providers: [
      provideRouter([]),
      {
        provide: AI_ASSISTANT_CONFIG,
        useValue: { agentUrl, agentId: 'default' },
      },
    ],
  });
}

describe('AiAssistantNavButtonComponent', () => {
  it('should stay hidden while no AG-UI runtime is configured', async () => {
    // given / when
    await renderNavButton('');

    // then
    expect(screen.queryByTestId('ai-assistant-nav-button')).toBeNull();
  });

  it('should link to the assistant route once a runtime is configured', async () => {
    // given / when
    await renderNavButton('https://agent.example.com/api/copilotkit');

    // then
    const link = screen.getByTestId('ai-assistant-nav-button');
    expect(link.getAttribute('href')).toBe('/assistant');
  });
});
