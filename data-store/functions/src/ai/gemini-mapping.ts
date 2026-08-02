import type { AgUiContextItem, AgUiMessage } from './ag-ui-messages';

/**
 * Transcript translation between the AG-UI wire format and Gemini.
 *
 * Kept free of `firebase-functions` and the Gemini client so the mapping —
 * which is where the protocol edge cases live — is unit-testable on its own.
 */
export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part
          ? String((part as { text?: unknown }).text ?? '')
          : ''
      )
      .join('');
  }
  return '';
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseToolResult(content: unknown): Record<string, unknown> {
  const text = messageText(content);
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  } catch {
    return { result: text };
  }
}

/**
 * Maps the AG-UI transcript onto Gemini `contents`.
 *
 * Two shapes need care: an assistant turn carrying tool calls becomes a `model`
 * turn of `functionCall` parts, and a tool result must name the function it
 * answers — AG-UI identifies it by `toolCallId` only, so the name is resolved
 * from the assistant turn that opened the call.
 */
export function toGeminiContents(
  messages: readonly AgUiMessage[],
  // `limitTranscript` drops orphaned results upstream, so an unresolved id now
  // means malformed input. Gemini then rejects the run over a
  // `functionResponse` named "unknown" with nothing in the logs to explain it —
  // reported through a callback so this module stays free of the logger.
  onUnresolvedToolCall?: (toolCallId: string) => void
): GeminiContent[] {
  const toolNamesByCallId = new Map<string, string>();
  for (const message of messages) {
    for (const call of message.toolCalls ?? []) {
      toolNamesByCallId.set(call.id, call.function.name);
    }
  }

  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (message.role === 'system' || message.role === 'developer') continue;

    if (message.role === 'tool') {
      const name = toolNamesByCallId.get(message.toolCallId ?? '');
      if (!name) onUnresolvedToolCall?.(message.toolCallId ?? '');
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: name ?? 'unknown',
              response: parseToolResult(message.content),
            },
          },
        ],
      });
      continue;
    }

    const parts: GeminiPart[] = [];
    const text = messageText(message.content);
    if (text.trim().length > 0) parts.push({ text });

    if (message.role === 'assistant') {
      for (const call of message.toolCalls ?? []) {
        parts.push({
          functionCall: {
            name: call.function.name,
            args: parseToolArguments(call.function.arguments),
          },
        });
      }
    }

    if (parts.length === 0) continue;
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  return contents;
}

/** Collects `system`/`developer` turns and AG-UI context into one preamble. */
export function toSystemInstruction(
  basePrompt: string,
  messages: readonly AgUiMessage[],
  context: readonly AgUiContextItem[]
): string {
  const sections = [basePrompt];

  for (const message of messages) {
    if (message.role !== 'system' && message.role !== 'developer') continue;
    const text = messageText(message.content).trim();
    if (text) sections.push(text);
  }

  for (const item of context) {
    const value = typeof item?.value === 'string' ? item.value.trim() : '';
    if (!value) continue;
    const description = item.description?.trim();
    sections.push(description ? `${description}:\n${value}` : value);
  }

  return sections.join('\n\n');
}
