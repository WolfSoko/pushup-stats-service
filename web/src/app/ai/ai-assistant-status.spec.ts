import { toAiAssistantStatus } from './ai-assistant-status';

describe('toAiAssistantStatus', () => {
  it('should report ready once the runtime is connected', () => {
    // given / when / then
    expect(toAiAssistantStatus('connected')).toBe('ready');
  });

  it('should report connecting only while the handshake is pending', () => {
    // given / when / then
    expect(toAiAssistantStatus('connecting')).toBe('connecting');
  });

  it('should treat the terminal error state as unavailable, not connecting', () => {
    // given / when
    const status = toAiAssistantStatus('error');

    // then
    expect(status).toBe('unavailable');
  });

  it('should treat a disconnected or unknown runtime as unavailable', () => {
    // given / when / then
    expect(toAiAssistantStatus('disconnected')).toBe('unavailable');
    expect(toAiAssistantStatus('something-new')).toBe('unavailable');
  });
});
