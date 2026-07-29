import {
  type AgUiMessage,
  toGeminiContents,
  toGeminiFunctionDeclarations,
  toGeminiSchema,
  toSystemInstruction,
} from './gemini-mapping';

describe('toGeminiSchema', () => {
  it('should drop the JSON Schema keywords Gemini rejects', () => {
    // given — this is what zod-to-json-schema emits for a z.object()
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      properties: {
        exerciseId: { type: 'string', description: 'Catalog id' },
        reps: { type: 'number' },
      },
      required: ['exerciseId', 'reps'],
    };

    // when
    const mapped = toGeminiSchema(schema);

    // then
    expect(mapped).toEqual({
      type: 'object',
      properties: {
        exerciseId: { type: 'string', description: 'Catalog id' },
        reps: { type: 'number' },
      },
      required: ['exerciseId', 'reps'],
    });
  });

  it('should strip unsupported keywords from nested property schemas', () => {
    // given
    const schema = {
      type: 'object',
      properties: {
        page: { type: 'string', enum: ['app'], default: 'app' },
      },
    };

    // when
    const mapped = toGeminiSchema(schema) as Record<string, never>;

    // then
    expect(mapped['properties']).toEqual({
      page: { type: 'string', enum: ['app'] },
    });
  });

  it('should give an empty object schema a properties map', () => {
    // given — getTrainingSummary takes no arguments
    const schema = { type: 'object', additionalProperties: false };

    // when
    const mapped = toGeminiSchema(schema);

    // then — Gemini rejects an object declaration without `properties`
    expect(mapped).toEqual({ type: 'object', properties: {} });
  });
});

describe('toGeminiFunctionDeclarations', () => {
  it('should map every named tool and default a missing description', () => {
    // given
    const tools = [
      { name: 'getTrainingSummary', parameters: { type: 'object' } },
      { name: 'navigateTo', description: 'Open a page', parameters: undefined },
    ];

    // when
    const declarations = toGeminiFunctionDeclarations(tools);

    // then
    expect(declarations).toEqual([
      {
        name: 'getTrainingSummary',
        description: '',
        parameters: { type: 'object', properties: {} },
      },
      { name: 'navigateTo', description: 'Open a page' },
    ]);
  });

  it('should skip entries without a usable name', () => {
    // given / when
    const declarations = toGeminiFunctionDeclarations([
      { name: '' },
      { name: 'ok' },
    ]);

    // then
    expect(declarations.map((d) => d.name)).toEqual(['ok']);
  });
});

describe('toGeminiContents', () => {
  it('should map user and assistant turns onto the Gemini roles', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: '1', role: 'user', content: 'Wie weit bin ich?' },
      { id: '2', role: 'assistant', content: 'Du bist bei 42.' },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Wie weit bin ich?' }] },
      { role: 'model', parts: [{ text: 'Du bist bei 42.' }] },
    ]);
  });

  it('should keep system turns out of the transcript', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: '1', role: 'system', content: 'Sei nett.' },
      { id: '2', role: 'user', content: 'Hi' },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then — they belong in the system instruction, not in `contents`
    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'Hi' }] }]);
  });

  it('should turn an assistant tool call into a functionCall part', () => {
    // given
    const messages: AgUiMessage[] = [
      {
        id: '1',
        role: 'assistant',
        toolCalls: [
          {
            id: 'call-1',
            function: {
              name: 'logExerciseEntry',
              arguments: '{"exerciseId":"pushup","reps":20}',
            },
          },
        ],
      },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then
    expect(contents).toEqual([
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              name: 'logExerciseEntry',
              args: { exerciseId: 'pushup', reps: 20 },
            },
          },
        ],
      },
    ]);
  });

  it('should name a tool result after the call it answers', () => {
    // given — AG-UI identifies the result by toolCallId only, Gemini needs the
    // function name.
    const messages: AgUiMessage[] = [
      {
        id: '1',
        role: 'assistant',
        toolCalls: [
          {
            id: 'call-1',
            function: { name: 'getTrainingSummary', arguments: '{}' },
          },
        ],
      },
      {
        id: '2',
        role: 'tool',
        toolCallId: 'call-1',
        content: '{"todayProgress":42}',
      },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then
    expect(contents[1]).toEqual({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'getTrainingSummary',
            response: { todayProgress: 42 },
          },
        },
      ],
    });
  });

  it('should wrap a non-JSON tool result instead of dropping it', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: '1', role: 'tool', toolCallId: 'unknown', content: 'fertig' },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then
    expect(contents[0].parts[0].functionResponse).toEqual({
      name: 'unknown',
      response: { result: 'fertig' },
    });
  });

  it('should skip turns that carry neither text nor tool calls', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: '1', role: 'assistant', content: '   ' },
      { id: '2', role: 'user', content: 'Hi' },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then — an empty part list makes Gemini reject the whole request
    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'Hi' }] }]);
  });

  it('should flatten multi-part text content', () => {
    // given
    const messages: AgUiMessage[] = [
      {
        id: '1',
        role: 'user',
        content: [
          { type: 'text', text: 'Ich habe ' },
          { type: 'text', text: '20 Liegestütze gemacht' },
        ],
      },
    ];

    // when
    const contents = toGeminiContents(messages);

    // then
    expect(contents[0].parts[0].text).toBe('Ich habe 20 Liegestütze gemacht');
  });
});

describe('toSystemInstruction', () => {
  it('should append system turns and agent context to the base prompt', () => {
    // given
    const messages: AgUiMessage[] = [
      { id: '1', role: 'system', content: 'Antworte knapp.' },
      { id: '2', role: 'user', content: 'Hi' },
    ];
    const context = [
      { description: 'App state', value: '{"today":{"todayProgress":42}}' },
    ];

    // when
    const instruction = toSystemInstruction('BASE', messages, context);

    // then
    expect(instruction).toBe(
      'BASE\n\nAntworte knapp.\n\nApp state:\n{"today":{"todayProgress":42}}'
    );
  });

  it('should ignore context entries without a value', () => {
    // given / when
    const instruction = toSystemInstruction(
      'BASE',
      [],
      [{ description: 'leer', value: '  ' }]
    );

    // then
    expect(instruction).toBe('BASE');
  });
});
