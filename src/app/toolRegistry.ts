import {
  setDefaultToolRegistry,
  ToolRegistry,
} from "../runtime/toolRegistry";
import { createCoreToolProvider } from "../runtime/tools/coreToolProvider";
import { createDevuniToolProvider } from "../runtime/plugins/devuni/devuniToolProvider";
import { createStToolProvider } from "../runtime/plugins/st/stToolProvider";

/** Host composition root; the runtime registry itself remains domain-neutral. */
export function createAppToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry([
    createCoreToolProvider(),
    createStToolProvider(),
    createDevuniToolProvider(),
  ]);
  setDefaultToolRegistry(registry);
  return registry;
}
