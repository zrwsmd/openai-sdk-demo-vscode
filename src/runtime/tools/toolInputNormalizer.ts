import type { Model } from "@openai/agents";

type JsonSchema = Record<string, unknown>;
type ContainerType = "array" | "object";

const MAX_NORMALIZATION_DEPTH = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asSchema(value: unknown): JsonSchema | undefined {
  return isRecord(value) ? value : undefined;
}

function nestedSchemas(schema: JsonSchema, key: "anyOf" | "oneOf" | "allOf"): JsonSchema[] {
  const values = schema[key];
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const nested = asSchema(value);
    return nested ? [nested] : [];
  });
}

function schemaBranches(schema: JsonSchema): JsonSchema[] {
  return [
    ...nestedSchemas(schema, "anyOf"),
    ...nestedSchemas(schema, "oneOf"),
  ];
}

function schemaContainerTypes(schema: JsonSchema): Set<ContainerType> {
  const result = new Set<ContainerType>();
  const type = schema.type;
  if (type === "array" || type === "object") result.add(type);
  if (Array.isArray(type)) {
    for (const item of type) {
      if (item === "array" || item === "object") result.add(item);
    }
  }
  if (schema.properties && isRecord(schema.properties)) result.add("object");
  if (schema.items !== undefined) result.add("array");
  for (const branch of [
    ...nestedSchemas(schema, "anyOf"),
    ...nestedSchemas(schema, "oneOf"),
    ...nestedSchemas(schema, "allOf"),
  ]) {
    for (const container of schemaContainerTypes(branch)) result.add(container);
  }
  return result;
}

function schemaAcceptsString(schema: JsonSchema): boolean {
  if (schema.type === "string") return true;
  if (Array.isArray(schema.type) && schema.type.includes("string")) return true;
  return [
    ...nestedSchemas(schema, "anyOf"),
    ...nestedSchemas(schema, "oneOf"),
    ...nestedSchemas(schema, "allOf"),
  ].some(schemaAcceptsString);
}

function schemaMatchesContainer(
  value: unknown,
  schema: JsonSchema,
): boolean {
  const containers = schemaContainerTypes(schema);
  return (
    (Array.isArray(value) && containers.has("array")) ||
    (isRecord(value) && containers.has("object"))
  );
}

function firstNestedSchema(
  schema: JsonSchema,
  key: "items" | "properties",
  property?: string,
): JsonSchema | undefined {
  if (key === "items") {
    const items = asSchema(schema.items);
    if (items) return items;
  } else if (property && isRecord(schema.properties)) {
    const nested = asSchema(schema.properties[property]);
    if (nested) return nested;
  }

  for (const branch of schemaBranches(schema)) {
    const nested = firstNestedSchema(branch, key, property);
    if (nested) return nested;
  }
  for (const branch of nestedSchemas(schema, "allOf")) {
    const nested = firstNestedSchema(branch, key, property);
    if (nested) return nested;
  }
  return undefined;
}

function normalizeValue(
  value: unknown,
  schema: JsonSchema | undefined,
  depth: number,
): unknown {
  if (!schema || depth > MAX_NORMALIZATION_DEPTH) return value;

  let next = value;
  const containers = schemaContainerTypes(schema);
  if (
    typeof next === "string" &&
    (containers.has("array") || containers.has("object")) &&
    !schemaAcceptsString(schema)
  ) {
    const trimmed = next.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (schemaMatchesContainer(parsed, schema)) {
          next = parsed;
        }
      } catch {
        // Preserve the original string so the normal schema validation can
        // return the precise field/type error to the model.
      }
    }
  }

  if (Array.isArray(next) && containers.has("array")) {
    const itemSchema = firstNestedSchema(schema, "items");
    return itemSchema
      ? next.map((item) => normalizeValue(item, itemSchema, depth + 1))
      : next;
  }

  if (isRecord(next) && containers.has("object")) {
    const result: Record<string, unknown> = { ...next };
    for (const [key, item] of Object.entries(next)) {
      const propertySchema = firstNestedSchema(schema, "properties", key);
      if (propertySchema) {
        result[key] = normalizeValue(item, propertySchema, depth + 1);
      }
    }
    return result;
  }

  return next;
}

export interface NormalizedToolArguments {
  value: string;
  changed: boolean;
}

function encodedContainerFields(
  value: unknown,
  path: string,
  result: string[],
  depth: number,
): void {
  if (depth > MAX_NORMALIZATION_DEPTH || result.length >= 8) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed) || isRecord(parsed)) {
          result.push(
            `${path || "<root>"} 是字符串，但内容看起来是 ${Array.isArray(parsed) ? "数组" : "对象"}`,
          );
        }
      } catch {
        // Keep malformed strings for the regular schema error.
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      encodedContainerFields(item, `${path}[${index}]`, result, depth + 1),
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      encodedContainerFields(item, path ? `${path}.${key}` : key, result, depth + 1);
    }
  }
}

/** Describe likely stringified containers for model-visible validation errors. */
export function describeEncodedToolArguments(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return undefined;
    const fields: string[] = [];
    encodedContainerFields(parsed, "", fields, 0);
    return fields.length ? fields.join("；") : undefined;
  } catch {
    return undefined;
  }
}

/** Report container fields still encoded as JSON strings against the schema. */
export function describeSchemaMismatches(
  raw: string,
  parameters: unknown,
): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  const schema = asSchema(parameters);
  if (!schema || !isRecord(value)) return undefined;
  const fields: string[] = [];

  const visit = (item: unknown, itemSchema: JsonSchema | undefined, path: string, depth: number): void => {
    if (!itemSchema || depth > MAX_NORMALIZATION_DEPTH || fields.length >= 8) return;
    if (typeof item === "string") {
      const expected = schemaContainerTypes(itemSchema);
      if (!expected.size || schemaAcceptsString(itemSchema)) return;
      try {
        const parsed = JSON.parse(item) as unknown;
        if (
          (Array.isArray(parsed) && expected.has("array")) ||
          (isRecord(parsed) && expected.has("object"))
        ) {
          fields.push(
            `${path || "<root>"} 当前为字符串，内容是${Array.isArray(parsed) ? "数组" : "对象"}`,
          );
        }
      } catch {
        // An invalid JSON string is still handled by the normal schema error.
      }
      return;
    }
    if (Array.isArray(item) && schemaContainerTypes(itemSchema).has("array")) {
      const child = firstNestedSchema(itemSchema, "items");
      item.forEach((entry, index) => visit(entry, child, `${path}[${index}]`, depth + 1));
      return;
    }
    if (isRecord(item) && schemaContainerTypes(itemSchema).has("object")) {
      for (const [key, entry] of Object.entries(item)) {
        visit(entry, firstNestedSchema(itemSchema, "properties", key), path ? `${path}.${key}` : key, depth + 1);
      }
    }
  };

  for (const [key, item] of Object.entries(value)) {
    visit(item, firstNestedSchema(schema, "properties", key), key, 0);
  }
  return fields.length ? fields.join("；") : undefined;
}

/**
 * Repair the common provider mistake of encoding an array/object field as a
 * JSON string. The expected shape comes from the tool's JSON schema, so this
 * is provider/model agnostic and does not alter ordinary string fields.
 */
export function normalizeToolArguments(
  raw: string,
  parameters: unknown,
): NormalizedToolArguments {
  if (typeof raw !== "string" || !raw.trim()) {
    return { value: raw, changed: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { value: raw, changed: false };
  }
  const schema = asSchema(parameters);
  if (!schema || !isRecord(parsed)) {
    return { value: raw, changed: false };
  }

  const normalized = normalizeValue(parsed, schema, 0);
  const before = JSON.stringify(parsed);
  const after = JSON.stringify(normalized);
  if (before === after) return { value: raw, changed: false };
  return { value: after, changed: true };
}

/** Normalize already-parsed input, for dynamic approval callbacks. */
export function normalizeToolInputValue(
  input: unknown,
  parameters: unknown,
): unknown {
  const schema = asSchema(parameters);
  return schema ? normalizeValue(input, schema, 0) : input;
}

type ToolSchema = { name?: unknown; type?: unknown; parameters?: unknown };
type FunctionCall = { type?: unknown; name?: unknown; arguments?: unknown };
type ModelResponse = Awaited<ReturnType<Model["getResponse"]>>;
type ModelRequest = Parameters<Model["getResponse"]>[0];
type StreamEvent = ReturnType<Model["getStreamedResponse"]> extends AsyncIterable<infer Event>
  ? Event
  : never;
type OneShotModel = Model & { requireToolOnce(toolName: string): void };

function toolSchemas(request: ModelRequest): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const candidate of request.tools ?? []) {
    const tool = candidate as ToolSchema;
    if (tool.type !== "function" || typeof tool.name !== "string") continue;
    result.set(tool.name, tool.parameters);
  }
  return result;
}

function normalizeFunctionCalls(
  output: readonly unknown[],
  schemas: Map<string, unknown>,
): unknown[] {
  let changed = false;
  const normalized = output.map((candidate) => {
    if (!isRecord(candidate)) return candidate;
    const call = candidate as FunctionCall;
    if (
      call.type !== "function_call" ||
      typeof call.name !== "string" ||
      typeof call.arguments !== "string"
    ) {
      return candidate;
    }
    const schema = schemas.get(call.name);
    if (!schema) return candidate;
    const repaired = normalizeToolArguments(call.arguments, schema);
    if (!repaired.changed) return candidate;
    changed = true;
    return { ...candidate, arguments: repaired.value };
  });
  return changed ? normalized : output as unknown[];
}

function normalizeModelResponse(
  response: ModelResponse,
  schemas: Map<string, unknown>,
): ModelResponse {
  const output = normalizeFunctionCalls(response.output, schemas);
  return output === response.output
    ? response
    : { ...response, output: output as ModelResponse["output"] };
}

/** Normalize function-call arguments before the Agents SDK parses or validates them. */
export function withToolInputNormalization(model: Model): Model & Partial<OneShotModel> {
  const wrapped: Model & Partial<OneShotModel> = {
    getResponse: async (request) => {
      const response = await model.getResponse(request);
      return normalizeModelResponse(response, toolSchemas(request));
    },
    getStreamedResponse: async function* (request) {
      const schemas = toolSchemas(request);
      for await (const event of model.getStreamedResponse(request)) {
        if (
          event.type === "response_done" &&
          isRecord(event.response) &&
          Array.isArray(event.response.output)
        ) {
          const output = normalizeFunctionCalls(event.response.output, schemas);
          if (output !== event.response.output) {
            yield {
              ...event,
              response: { ...event.response, output },
            } as StreamEvent;
            continue;
          }
        }
        yield event;
      }
    },
    ...(model.getRetryAdvice
      ? { getRetryAdvice: (args) => model.getRetryAdvice!(args) }
      : {}),
  };

  if (typeof (model as Partial<OneShotModel>).requireToolOnce === "function") {
    wrapped.requireToolOnce = (toolName) =>
      (model as OneShotModel).requireToolOnce(toolName);
  }
  return wrapped;
}
