import type { Tool } from "@openai/agents";
import type { ToolProvider } from "../../toolRegistry";
import { createDevuniCommandTools } from "./createDevuniCommandTools";
import { DEVUNI_COMMANDS } from "./devuniCommands";

/**
 * 外部 IDE 插件(devUni)能力来源。
 *
 * 能力表直接由声明表推导,所以新接口的能力元数据只有一处定义,
 * 不会出现"工具加了但路由看不见"的情况。
 */
export function createDevuniToolProvider(): ToolProvider {
  return {
    id: "devuni",
    capabilities: DEVUNI_COMMANDS.map((command) => command.capability),
    createTools(context): readonly Tool[] {
      return createDevuniCommandTools(DEVUNI_COMMANDS, context);
    },
  };
}
