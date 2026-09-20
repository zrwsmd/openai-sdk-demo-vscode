import { tool } from "@openai/agents";
import { z } from "zod";
import { runCommand } from "../../tools/workspaceTools";
import {
  commandToolResult,
  type ToolBuildContext,
} from "./toolBuildContext";

export function createRunCommandTool(ctx: ToolBuildContext) {
  const {
    guard,
    guardrails,
    workspace,
    withEffect,
  } = ctx;

  return tool({
    name: "run_command",
    description:
      "在工作区根目录执行一条 shell 命令(60 秒超时,输出截断)。属于危险操作,执行前需要用户批准。" +
      "Windows 宿主使用 cmd.exe 语法;不要在组合命令里使用 PowerShell 专属的 `$null`、`;` 或管道重定向写法。需要 PowerShell 时显式执行 powershell -NoProfile -Command \"...\"。",
    parameters: z.object({ command: z.string().describe("要执行的命令行") }),
    needsApproval: true,
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ command }, _context, details) =>
      guard(
        () =>
          withEffect("run_command", { command }, "execute", async () =>
            commandToolResult(
              command,
              await runCommand(
                workspace.primaryRoot,
                command,
                60_000,
                details?.signal,
              ),
            ),
          ),
        "execute",
        "process",
      ),
  });
}
