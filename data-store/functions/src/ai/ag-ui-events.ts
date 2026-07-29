/**
 * Minimal AG-UI event emitter.
 *
 * The protocol is a handful of JSON shapes streamed as SSE, so the events are
 * declared here instead of pulling `@ag-ui/core` (and its zod dependency) into
 * the functions bundle. `ag-ui-events.spec.ts` pins these strings against the
 * package's `EventType` enum, so a protocol rename fails CI rather than
 * silently breaking the client.
 */
export const AG_UI_EVENT = {
  RUN_STARTED: 'RUN_STARTED',
  RUN_FINISHED: 'RUN_FINISHED',
  RUN_ERROR: 'RUN_ERROR',
  TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
  TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
  TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
  TOOL_CALL_START: 'TOOL_CALL_START',
  TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
  TOOL_CALL_END: 'TOOL_CALL_END',
} as const;

export type AgUiEvent = Record<string, unknown> & { type: string };

/** Sink for the encoded SSE frames — `res.write` in production. */
export type AgUiEventSink = (frame: string) => void;

export function encodeSseFrame(event: AgUiEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Serialises a run into a protocol-valid event sequence.
 *
 * The client verifies ordering: exactly one `RUN_STARTED` first, no interleaved
 * text and tool-call blocks, and every opened block closed before the next one
 * starts. `close*` bookkeeping lives here so callers can emit deltas in
 * whatever order the model produces them.
 */
export class AgUiRunEmitter {
  #openTextMessageId: string | null = null;
  #openToolCallId: string | null = null;
  #finished = false;

  constructor(
    private readonly sink: AgUiEventSink,
    private readonly threadId: string,
    private readonly runId: string
  ) {}

  runStarted(): void {
    this.#emit({
      type: AG_UI_EVENT.RUN_STARTED,
      threadId: this.threadId,
      runId: this.runId,
    });
  }

  textDelta(messageId: string, delta: string): void {
    if (this.#openTextMessageId !== messageId) {
      this.#closeOpenBlock();
      this.#emit({
        type: AG_UI_EVENT.TEXT_MESSAGE_START,
        messageId,
        role: 'assistant',
      });
      this.#openTextMessageId = messageId;
    }
    if (delta.length === 0) return;
    this.#emit({
      type: AG_UI_EVENT.TEXT_MESSAGE_CONTENT,
      messageId,
      delta,
    });
  }

  /**
   * Gemini hands back complete function calls rather than streamed argument
   * deltas, so a call is emitted as one start/args/end triple.
   */
  toolCall(
    toolCallId: string,
    toolCallName: string,
    args: unknown,
    parentMessageId: string
  ): void {
    this.#closeOpenBlock();
    this.#emit({
      type: AG_UI_EVENT.TOOL_CALL_START,
      toolCallId,
      toolCallName,
      parentMessageId,
    });
    this.#openToolCallId = toolCallId;
    this.#emit({
      type: AG_UI_EVENT.TOOL_CALL_ARGS,
      toolCallId,
      delta: JSON.stringify(args ?? {}),
    });
    this.#closeOpenBlock();
  }

  runFinished(): void {
    if (this.#finished) return;
    this.#closeOpenBlock();
    this.#emit({
      type: AG_UI_EVENT.RUN_FINISHED,
      threadId: this.threadId,
      runId: this.runId,
    });
    this.#finished = true;
  }

  /**
   * Terminates the run with an error. `RUN_ERROR` replaces `RUN_FINISHED`, so a
   * run that already finished stays untouched.
   */
  runError(message: string, code?: string): void {
    if (this.#finished) return;
    this.#closeOpenBlock();
    this.#emit({
      type: AG_UI_EVENT.RUN_ERROR,
      message,
      ...(code ? { code } : {}),
    });
    this.#finished = true;
  }

  #closeOpenBlock(): void {
    if (this.#openTextMessageId) {
      this.#emit({
        type: AG_UI_EVENT.TEXT_MESSAGE_END,
        messageId: this.#openTextMessageId,
      });
      this.#openTextMessageId = null;
    }
    if (this.#openToolCallId) {
      this.#emit({
        type: AG_UI_EVENT.TOOL_CALL_END,
        toolCallId: this.#openToolCallId,
      });
      this.#openToolCallId = null;
    }
  }

  #emit(event: AgUiEvent): void {
    this.sink(encodeSseFrame(event));
  }
}
