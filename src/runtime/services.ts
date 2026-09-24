/**
 * Host-provided runtime capabilities.
 *
 * The core runtime stores and forwards opaque services. Domain plugins own
 * the service keys and the value types associated with them.
 */
export type RuntimeServiceContainer = ReadonlyMap<string, unknown>;

export const EMPTY_RUNTIME_SERVICES: RuntimeServiceContainer = new Map();

export function createRuntimeServiceContainer(
  entries: Iterable<readonly [string, unknown]> | Record<string, unknown> = [],
): RuntimeServiceContainer {
  if (Symbol.iterator in Object(entries)) {
    return new Map(entries as Iterable<readonly [string, unknown]>);
  }
  return new Map(Object.entries(entries));
}

export function getRuntimeService<T>(
  services: RuntimeServiceContainer | undefined,
  key: string,
): T | undefined {
  return services?.get(key) as T | undefined;
}
