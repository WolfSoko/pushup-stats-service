import type { AgUiTool } from './ag-ui-messages';

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/** JSON Schema keywords Gemini's function-declaration parser rejects. */
const UNSUPPORTED_SCHEMA_KEYS = new Set([
  '$schema',
  '$id',
  '$ref',
  'additionalProperties',
  'definitions',
  '$defs',
  'const',
  'default',
  'examples',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'not',
  'oneOf',
  'allOf',
  'patternProperties',
]);

/**
 * Strips JSON Schema keywords Gemini rejects. `zod-to-json-schema` emits
 * `$schema` and `additionalProperties` by default, and Gemini answers the whole
 * request with a 400 when it sees them — so a single stray keyword takes down
 * every tool, not just the offending one.
 */
export function toGeminiSchema(
  schema: unknown
): Record<string, unknown> | undefined {
  if (Array.isArray(schema)) {
    // `required` and `enum` hold plain strings — recursing into them would
    // map every entry to undefined and make Gemini reject the declaration.
    return schema.map((entry) =>
      typeof entry === 'object' && entry !== null
        ? toGeminiSchema(entry)
        : entry
    ) as unknown as Record<string, unknown>;
  }
  if (typeof schema !== 'object' || schema === null) return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;

    if (key === 'properties' && typeof value === 'object') {
      const properties: Record<string, unknown> = {};
      for (const [name, propertySchema] of Object.entries(
        value as Record<string, unknown>
      )) {
        const mapped = toGeminiSchema(propertySchema);
        if (mapped) properties[name] = mapped;
      }
      result[key] = properties;
      continue;
    }

    if (typeof value === 'object') {
      const mapped = toGeminiSchema(value);
      if (mapped) result[key] = mapped;
      continue;
    }

    result[key] = value;
  }

  // Gemini rejects an object schema without properties; describe it as empty.
  if (result['type'] === 'object' && !result['properties']) {
    result['properties'] = {};
  }
  return result;
}

export function toGeminiFunctionDeclarations(
  tools: readonly AgUiTool[]
): GeminiFunctionDeclaration[] {
  return tools
    .filter((tool) => typeof tool?.name === 'string' && tool.name.length > 0)
    .map((tool) => {
      const parameters = toGeminiSchema(tool.parameters);
      return {
        name: tool.name,
        description: tool.description ?? '',
        ...(parameters ? { parameters } : {}),
      };
    });
}
