import { toGeminiFunctionDeclarations, toGeminiSchema } from './gemini-schema';

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
