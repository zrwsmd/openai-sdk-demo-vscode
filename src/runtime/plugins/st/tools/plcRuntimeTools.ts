import { tool } from '@openai/agents';
import { z } from 'zod';
import {
  auditPlcRuntimeConfigWorkspace,
} from '../../../../plc/plcRuntimeConfigAudit';
import type { StToolBuildContext } from '../stToolContext';

export function createPlcRuntimeTools(context: StToolBuildContext) {
  const { contract, failed, guard, guardrails, workspace } = context;

  const auditPlcRuntimeConfig = tool({
    name: 'audit_plc_runtime_config',
    description:
      '只读检查 PLC 任务组态(plc-runtime.json)与工作区 ST 程序的一致性。' +
      '当用户问任务周期、PLC 任务绑定、plc-runtime.json 是否正确、编译前组态检查、为什么 PROGRAM 没有任务绑定时使用。' +
      '会扫描 .st 文件并报告缺少配置、配置损坏、PROGRAM 未绑定、绑定源文件不存在、声明不匹配和 event 任务运行时适配提示。' +
      '本工具不写文件、不自动生成默认周期;首次配置仍需要用户通过任务组态弹窗确认。',
    parameters: z.object({
      maxFiles: z
        .number()
        .int()
        .positive()
        .max(5000)
        .optional()
        .describe('最多扫描多少个 .st 文件,默认 1000'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ maxFiles }) =>
      guard(async () => {
        const workspaceRoot = workspace.primaryRoot;
        if (!workspaceRoot) return failed(new Error('未打开工作区文件夹，PLC 任务组态审计不可用'), 'read');
        const report = await auditPlcRuntimeConfigWorkspace({
          workspaceRoot,
          ...(maxFiles === undefined ? {} : { maxFiles }),
        });
        return contract(
          {
            configState: report.configState,
            configPath: report.configPath,
            summary: report.summary,
            issues: report.issues,
            stFiles: report.stFiles.map((file) => ({
              source: file.source,
              programs: file.declarations.map((declaration) => ({
                name: declaration.name,
                line: declaration.line,
                character: declaration.character,
              })),
              resolutions: file.resolutions.map((resolution) => ({
                programName: resolution.declaration.name,
                status: resolution.status,
                matches: resolution.matches.map((match) => ({
                  resourceName: match.resourceName,
                  taskName: match.taskName,
                  instanceName: match.binding.instanceName,
                  source: match.binding.source,
                })),
                typeMatches: resolution.typeMatches.map((match) => ({
                  resourceName: match.resourceName,
                  taskName: match.taskName,
                  instanceName: match.binding.instanceName,
                  source: match.binding.source,
                })),
              })),
            })),
          },
          'read',
        );
      }, 'read'),
  });

  return { auditPlcRuntimeConfig };
}
