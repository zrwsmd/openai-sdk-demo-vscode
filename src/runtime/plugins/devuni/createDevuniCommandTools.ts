/**
 * 声明 → 工具 的通用工厂。
 *
 * 这个文件对每个接口都长一个样,所以只在加"新的一类"接口时才需要动它;
 * 加"一条"新接口请改 devuniCommands.ts。
 */
import { tool, type Tool } from "@openai/agents";
import { getRuntimeService } from "../../services";
import type { ToolBuildContext } from "../../tools/toolBuildContext";
import {
  DEVUNI_COMMAND_PORT_SERVICE,
  type DevuniCommandPort,
} from "./devuniCommandPort";
import type { DevuniCommandDescriptor } from "./devuniCommands";
import { workspaceRootsFromWorkspaceFile } from "./devuniProjectRoots";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createDevuniCommandTool(
  descriptor: DevuniCommandDescriptor,
  context: ToolBuildContext,
): Tool {
  const { contract, failed, guard, guardrails } = context;
  const risk = descriptor.capability.risk ?? "execute";
  const effect = descriptor.capability.effect ?? "none";
  const requiresApproval = risk === "write" || risk === "execute";

  return tool({
    name: descriptor.toolName,
    description: descriptor.description,
    parameters: descriptor.parameters,
    ...(requiresApproval ? { needsApproval: true } : {}),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: (input: unknown) =>
      guard(
        async () => {
          const port = getRuntimeService<DevuniCommandPort>(
            context.services,
            DEVUNI_COMMAND_PORT_SERVICE,
          );
          if (!port) {
            return failed(
              new Error(
                "外部 IDE 插件通道不可用:当前运行环境没有注入 devuni 命令端口。",
              ),
              risk,
              effect,
            );
          }

          let args: unknown;
          try {
            args = await descriptor.buildArgs(input, port);
          } catch (error) {
            return failed(error, risk, effect);
          }

          let raw: unknown;
          try {
            raw = await port.invoke(descriptor.bridgeCommand, args);
          } catch (error) {
            return failed(
              new Error(
                `调用外部插件命令 ${descriptor.bridgeCommand} 失败:${messageOf(error)}`,
              ),
              risk,
              effect,
            );
          }

          const outcome = descriptor.toOutcome(raw, input);
          if (!outcome.ok) {
            return failed(new Error(outcome.error), risk, effect);
          }
          // A project may be created and then used later in the same agent run.
          // Promote its actual folder immediately so the next relative file
          // tool in this run sees the same authorization as the next chat turn.
          if (descriptor.bridgeCommand === "bridgeCreateProject") {
            const data = outcome.data;
            const workspaceFile =
              data && typeof data === "object" && !Array.isArray(data) &&
              typeof (data as { workspaceFile?: unknown }).workspaceFile === "string"
                ? (data as { workspaceFile: string }).workspaceFile
                : undefined;
            if (workspaceFile) {
              const roots = await workspaceRootsFromWorkspaceFile(workspaceFile);
              for (const root of [...roots].reverse()) {
                context.workspace.addRoot(root, true);
              }
            }
          }
          return contract(
            { summary: outcome.summary, result: outcome.data },
            risk,
            effect,
            outcome.actions,
          );
        },
        risk,
        effect,
      ),
  });
}

export function createDevuniCommandTools(
  descriptors: readonly DevuniCommandDescriptor[],
  context: ToolBuildContext,
): readonly Tool[] {
  return descriptors.map((descriptor) =>
    createDevuniCommandTool(descriptor, context),
  );
}
