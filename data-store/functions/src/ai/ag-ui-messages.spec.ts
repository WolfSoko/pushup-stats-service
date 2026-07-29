import { type AgUiMessage, limitTranscript } from './ag-ui-messages';

function userTurn(id: number): AgUiMessage {
  return { id: `u${id}`, role: 'user', content: `Nachricht ${id}` };
}

describe('limitTranscript', () => {
  it('should return a short transcript unchanged', () => {
    // given
    const messages = [userTurn(1), userTurn(2)];

    // when
    const limited = limitTranscript(messages, 40);

    // then
    expect(limited).toEqual(messages);
  });

  it('should copy rather than alias the caller array', () => {
    // given
    const messages = [userTurn(1)];

    // when
    const limited = limitTranscript(messages, 40);

    // then
    expect(limited).not.toBe(messages);
  });

  it('should keep the newest turns once the transcript exceeds the limit', () => {
    // given
    const messages = Array.from({ length: 45 }, (_, i) => userTurn(i));

    // when
    const limited = limitTranscript(messages, 40);

    // then
    expect(limited).toHaveLength(40);
    expect(limited[0].id).toBe('u5');
    expect(limited[39].id).toBe('u44');
  });

  it('should drop a tool result whose opening call fell outside the window', () => {
    // given — the slice boundary lands between the assistant turn carrying
    // `toolCalls` and the result answering it.
    const messages: AgUiMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        toolCalls: [
          {
            id: 'call-1',
            function: { name: 'getTrainingSummary', arguments: '{}' },
          },
        ],
      },
      { id: 't1', role: 'tool', toolCallId: 'call-1', content: '{}' },
      userTurn(1),
      userTurn(2),
    ];

    // when
    const limited = limitTranscript(messages, 3);

    // then — an orphaned functionResponse makes Gemini reject the run
    expect(limited.map((m) => m.id)).toEqual(['u1', 'u2']);
  });

  it('should drop every leading tool result, not just the first', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: 't1', role: 'tool', toolCallId: 'call-1', content: '{}' },
      { id: 't2', role: 'tool', toolCallId: 'call-2', content: '{}' },
      userTurn(1),
    ];

    // when
    const limited = limitTranscript(messages, 3);

    // then
    expect(limited.map((m) => m.id)).toEqual(['u1']);
  });

  it('should keep a tool result that still has its opening call in the window', () => {
    // given
    const assistant: AgUiMessage = {
      id: 'a1',
      role: 'assistant',
      toolCalls: [
        {
          id: 'call-1',
          function: { name: 'getTrainingSummary', arguments: '{}' },
        },
      ],
    };
    const messages: AgUiMessage[] = [
      userTurn(0),
      assistant,
      { id: 't1', role: 'tool', toolCallId: 'call-1', content: '{}' },
    ];

    // when
    const limited = limitTranscript(messages, 3);

    // then
    expect(limited.map((m) => m.id)).toEqual(['u0', 'a1', 't1']);
  });
});
