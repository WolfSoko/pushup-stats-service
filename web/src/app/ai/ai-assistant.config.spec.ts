import { isAiAssistantEnabled, resolveRuntimeUrl } from './ai-assistant.config';

describe('resolveRuntimeUrl', () => {
  it('should strip surrounding whitespace so it never reaches fetch', () => {
    // given
    const config = {
      runtimeUrl: '  https://agent.example.com/api/copilotkit  ',
      agentId: 'default',
    };

    // when
    const runtimeUrl = resolveRuntimeUrl(config);

    // then
    expect(runtimeUrl).toBe('https://agent.example.com/api/copilotkit');
  });

  it('should collapse a whitespace-only value to the empty string', () => {
    // given / when / then
    expect(resolveRuntimeUrl({ runtimeUrl: '   ', agentId: 'default' })).toBe(
      ''
    );
  });
});

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
