import { isAiAssistantEnabled } from './ai-assistant.config';

describe('isAiAssistantEnabled', () => {
  it('should be disabled when no runtime URL is configured', () => {
    // given / when / then
    expect(isAiAssistantEnabled({ runtimeUrl: '', agentId: 'default' })).toBe(
      false
    );
  });

  it('should be disabled when the runtime URL is only whitespace', () => {
    // given / when / then
    expect(
      isAiAssistantEnabled({ runtimeUrl: '   ', agentId: 'default' })
    ).toBe(false);
  });

  it('should be enabled once a runtime URL is configured', () => {
    // given
    const config = {
      runtimeUrl: 'https://agent.example.com/api/copilotkit',
      agentId: 'default',
    };

    // when
    const enabled = isAiAssistantEnabled(config);

    // then
    expect(enabled).toBe(true);
  });
});
