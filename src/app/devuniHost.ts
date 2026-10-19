/**
 * 外部 IDE 插件(devUni)的宿主装配层(src/app)。
 *
 * 跟 analyzerHost 一样,这里是这套能力里唯一 import vscode 的地方:
 * 桥怎么初始化、命令打到哪个扩展、参数怎么递过去,全部关在这里;
 * 内核只看到 devuniCommandPort 里那一句纯数据的 invoke。
 *
 * 桥包没有发布到任何 npm registry,所以随仓库自带在 vendor/vscode-command-bridge。
 */
import * as vscode from "vscode";
import * as bridge from "../../vendor/vscode-command-bridge";
import type { DevuniCommandPort } from "../runtime/plugins/devuni/devuniCommandPort";

export interface CreatedDevuniProject {
  workspaceFile: string;
  projectName?: string;
  parentDirectory?: string;
  deviceModel?: string;
  language?: string;
  projectType?: string;
}

export interface DevuniCommandPortOptions {
  /** Called after a project was created successfully by the external plugin. */
  onProjectCreated?: (project: CreatedDevuniProject) => Promise<void> | void;
}

/**
 * 桥需要拿到 vscode API 才能 executeCommand。扩展宿主里这一步是幂等的,
 * 但只在第一次真正用到时做,避免在扩展激活阶段就引入不必要的副作用。
 */
let bridgeReady = false;

function ensureBridgeReady(): void {
  if (bridgeReady) return;
  bridge.initialize(vscode);
  bridgeReady = true;
}

export function createDevuniCommandPort(
  options: DevuniCommandPortOptions = {},
): DevuniCommandPort {
  return {
    async invoke(command: string, ...args: unknown[]): Promise<unknown> {
      ensureBridgeReady();
      const result = await bridge.invokeExtensionCommand(command, ...args);
      if (
        command === "bridgeCreateProject" &&
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        (result as { status?: unknown }).status === true
      ) {
        const workspaceFile = (result as { wsUri?: unknown }).wsUri;
        if (typeof workspaceFile === "string" && workspaceFile.trim()) {
          const input = args[0] && typeof args[0] === "object" && !Array.isArray(args[0])
            ? args[0] as Record<string, unknown>
            : {};
          const readText = (key: string): string | undefined => {
            const value = input[key];
            return typeof value === "string" && value.trim() ? value.trim() : undefined;
          };
          await options.onProjectCreated?.({
            workspaceFile: workspaceFile.trim(),
            ...(readText("projectName") ? { projectName: readText("projectName") } : {}),
            ...(readText("projectPath") ? { parentDirectory: readText("projectPath") } : {}),
            ...(readText("deviceModel") ? { deviceModel: readText("deviceModel") } : {}),
            ...(readText("lan") ? { language: readText("lan") } : {}),
            ...(readText("prjType") ? { projectType: readText("prjType") } : {}),
          });
        }
      }
      return result;
    },
  };
}
