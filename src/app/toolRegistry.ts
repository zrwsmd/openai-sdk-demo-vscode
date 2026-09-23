import {
  setDefaultToolRegistry,
  ToolRegistry,
} from "../runtime/toolRegistry";
import { createCoreToolProvider } from "../runtime/tools/coreToolProvider";
import { createStToolProvider } from "../runtime/workflows/stToolProvider";

/** Host composition root; the runtime registry itself remains domain-neutral. */
export function createAppToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry([
    createCoreToolProvider(),
    createStToolProvider(),
  ]);
  setDefaultToolRegistry(registry);
  return registry;
}
