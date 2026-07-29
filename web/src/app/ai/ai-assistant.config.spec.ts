import { isAiAssistantEnabled, resolveAgentUrl } from './ai-assistant.config';

describe('resolveAgentUrl', () => {
  it('should strip surrounding whitespace so it never reaches fetch', () => {
    // given
    const config = {
      agentUrl: '  https://agent.example.com/agUiAgent  ',
      agentId: 'default',
    };

    // when
    const agentUrl = resolveAgentUrl(config);

    // then
    expect(agentUrl).toBe('https://agent.example.com/agUiAgent');
  });

  it('should collapse a whitespace-only value to the empty string', () => {
    // given
    const config = { agentUrl: '   ', agentId: 'default' };

    // when
    const agentUrl = resolveAgentUrl(config);

    // then
    expect(agentUrl).toBe('');
  });
});

describe('isAiAssistantEnabled', () => {
  it('should be disabled when no agent URL is configured', () => {
    // given
    const config = { agentUrl: '', agentId: 'default' };

    // when
    const enabled = isAiAssistantEnabled(config);

    // then
    expect(enabled).toBe(false);
  });

  it('should be disabled when the agent URL is only whitespace', () => {
    // given
    const config = { agentUrl: '   ', agentId: 'default' };

    // when
    const enabled = isAiAssistantEnabled(config);

    // then
    expect(enabled).toBe(false);
  });

  it('should be enabled once an agent URL is configured', () => {
    // given
    const config = {
      agentUrl: 'https://agent.example.com/agUiAgent',
      agentId: 'default',
    };

    // when
    const enabled = isAiAssistantEnabled(config);

    // then
    expect(enabled).toBe(true);
  });
});
