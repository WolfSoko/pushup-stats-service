import { EventType } from '@ag-ui/core';
import { AG_UI_EVENT, AgUiRunEmitter, encodeSseFrame } from './ag-ui-events';

function collect(): { frames: string[]; sink: (frame: string) => void } {
  const frames: string[] = [];
  return { frames, sink: (frame) => frames.push(frame) };
}

function typesOf(frames: string[]): string[] {
  return frames.map(
    (frame) => JSON.parse(frame.replace(/^data: /, '').trim()).type
  );
}

function payloadsOf(frames: string[]): Record<string, unknown>[] {
  return frames.map((frame) => JSON.parse(frame.replace(/^data: /, '').trim()));
}

describe('AG_UI_EVENT', () => {
  it('should match the event names the @ag-ui/core protocol defines', () => {
    // given — the emitter hand-rolls the protocol to keep zod out of the
    // functions bundle, so a rename upstream must fail here.
    const declared = Object.values(AG_UI_EVENT);
    const upstream = new Set<string>(Object.values(EventType));

    // when
    const unknown = declared.filter((name) => !upstream.has(name));

    // then
    expect(unknown).toEqual([]);
  });
});

describe('encodeSseFrame', () => {
  it('should terminate every frame with a blank line', () => {
    // given / when
    const frame = encodeSseFrame({ type: 'RUN_STARTED' });

    // then
    expect(frame).toBe('data: {"type":"RUN_STARTED"}\n\n');
  });
});

describe('AgUiRunEmitter', () => {
  it('should open a text message once and stream further deltas into it', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-1', 'run-1');

    // when
    emitter.runStarted();
    emitter.textDelta('msg-1', 'Hallo');
    emitter.textDelta('msg-1', ' Welt');
    emitter.runFinished();

    // then
    expect(typesOf(frames)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_FINISHED',
    ]);
  });

  it('should close an open text message before starting a tool call', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-1', 'run-1');

    // when
    emitter.runStarted();
    emitter.textDelta('msg-1', 'Trage ein …');
    emitter.toolCall('call-1', 'logExerciseEntry', { reps: 20 }, 'msg-1');
    emitter.runFinished();

    // then — interleaved blocks would fail the client's event verifier.
    expect(typesOf(frames)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'TOOL_CALL_START',
      'TOOL_CALL_ARGS',
      'TOOL_CALL_END',
      'RUN_FINISHED',
    ]);
  });

  it('should serialise tool arguments as a JSON string delta', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-1', 'run-1');

    // when
    emitter.toolCall(
      'call-1',
      'logExerciseEntry',
      {
        exerciseId: 'pushup',
        reps: 20,
      },
      'msg-1'
    );

    // then
    const args = payloadsOf(frames).find((e) => e['type'] === 'TOOL_CALL_ARGS');
    expect(args?.['delta']).toBe('{"exerciseId":"pushup","reps":20}');
  });

  it('should close a dangling text message when the run errors', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-1', 'run-1');

    // when
    emitter.runStarted();
    emitter.textDelta('msg-1', 'teilweise');
    emitter.runError('kaputt', 'agent-error');

    // then
    expect(typesOf(frames)).toEqual([
      'RUN_STARTED',
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
      'RUN_ERROR',
    ]);
  });

  it('should not terminate a run twice', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-1', 'run-1');

    // when
    emitter.runStarted();
    emitter.runFinished();
    emitter.runError('zu spät');
    emitter.runFinished();

    // then
    expect(typesOf(frames)).toEqual(['RUN_STARTED', 'RUN_FINISHED']);
  });

  it('should carry the thread and run id on the lifecycle events', () => {
    // given
    const { frames, sink } = collect();
    const emitter = new AgUiRunEmitter(sink, 'thread-7', 'run-9');

    // when
    emitter.runStarted();
    emitter.runFinished();

    // then
    for (const payload of payloadsOf(frames)) {
      expect(payload['threadId']).toBe('thread-7');
      expect(payload['runId']).toBe('run-9');
    }
  });
});
