import { tool } from "@openai/agents";
import { z } from "zod";
import type { CommandShell } from "../../tools/commandRunner";
import {
  commandToolResult,
  type ToolBuildContext,
} from "./toolBuildContext";

export function createRunCommandTool(ctx: ToolBuildContext) {
  const {
    guard,
    guardrails,
    workspace,
    commandRunner,
    withEffect,
  } = ctx;

  return tool({
    name: "run_command",
    description:
      "在工作区根目录执行一条命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。" +
      "shell=auto 时 Windows 会自动识别 Get-Content、Select-Object、$env: 等 PowerShell 命令；普通 node/git/npm/rg 命令保持原有 shell。" +
      "需要时可显式指定 shell=powershell、native 或 auto。",
    parameters: z.object({
      command: z.string().describe("要执行的命令行"),
      shell: z.enum(["auto", "native", "powershell"]).optional().describe(
        "命令解释器：auto(默认，自动识别)、native(宿主默认 shell)、powershell(PowerShell)",
      ),
    }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ command, shell }, _context, details) =>
      guard(
        () =>
          withEffect("run_command", { command, ...(shell ? { shell } : {}) }, "execute", async () =>
            commandToolResult(
              command,
              await commandRunner.run({
                cwd: workspace.primaryRoot,
                command,
                ...(shell ? { shell: shell as CommandShell } : {}),
                timeoutMs: 60_000,
                signal: details?.signal,
              }),
            ),
          ),
        "execute",
        "process",
      ),
  });
}
