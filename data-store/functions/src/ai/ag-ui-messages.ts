/** AG-UI wire shapes the agent endpoint consumes. */
export interface AgUiToolCall {
  readonly id: string;
  readonly function: { readonly name: string; readonly arguments: string };
}

export interface AgUiMessage {
  readonly id: string;
  readonly role: string;
  readonly content?: unknown;
  readonly toolCalls?: readonly AgUiToolCall[];
  readonly toolCallId?: string;
}

export interface AgUiTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: unknown;
}

export interface AgUiContextItem {
  readonly description?: string;
  readonly value?: string;
}

/** Upper bound on transcript turns forwarded to Gemini, newest kept. */
export const MAX_TRANSCRIPT_MESSAGES = 40;

/**
 * Keeps the prompt payload bounded on long threads.
 *
 * Trims leading tool results after slicing: a plain tail slice can cut between
 * an assistant turn carrying `toolCalls` and the result answering it, leaving a
 * `functionResponse` with no matching `functionCall`. Gemini rejects that, so a
 * long-running thread would stay broken until the window moved past it.
 */
export function limitTranscript(
  messages: readonly AgUiMessage[],
  limit: number = MAX_TRANSCRIPT_MESSAGES
): AgUiMessage[] {
  const window =
    messages.length <= limit
      ? [...messages]
      : messages.slice(messages.length - limit);

  let start = 0;
  while (start < window.length && window[start].role === 'tool') start += 1;
  return window.slice(start);
}
