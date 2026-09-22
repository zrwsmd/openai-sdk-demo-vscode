/**
 * ST 语义分析工具族(依赖图 / 变更影响面)。
 *
 * 与 workspaceReadTools / validateStTool 同一形态:工厂函数 + 薄壳工具,
 * 全部基建(guard、审批策略、工作区边界、审计、降级)复用 ToolBuildContext。
 * 能力本体在 analysis 层(桥的 action=graph/impact),这里只做参数校验与回执投影。
 */
import path from 'node:path';
import { z } from 'zod';
import { tool } from '@openai/agents';
import { collectWorkspaceStContext } from '../../analysis/workspaceStContext';
import type {
  StAnalyzerEngineInfo,
  StTarget,
} from '../../analysis/stAnalyzer';
import type { ToolBuildContext } from './toolBuildContext';

/** 回执里最多列出的条目数(超出部分只报计数,避免刷爆上下文) */
const MAX_LISTED = 40;

export function createStGraphTools(context: ToolBuildContext) {
  const { stAnalyzer, stToolOptions, workspace, guard, contract, failed, guardrails } = context;

  const toDisplay = (absolutePath: string): string => {
    const root = workspace.primaryRoot;
    if (!root) return absolutePath;
    const relative = path.relative(root, absolutePath);
    if (!relative || relative.startsWith('..')) return absolutePath;
    return relative.split(path.sep).join('/');
  };

  const collectWorkspaceFiles = async (excludePaths: string[] = []) =>
    collectWorkspaceStContext(workspace, {
      maxFiles: stToolOptions.maxContextFiles,
      maxFileBytes: stToolOptions.maxFileBytes,
      excludePaths,
    });

  /** 降级:真实语言服务不可用时如实上报,并给出替代路径(不做假的空图) */
  const degraded = (toolName: string, engine: StAnalyzerEngineInfo, reason: string) =>
    contract(
      {
        engine: engine.id,
        fallbackReason: engine.fallbackReason,
        detail: engine.detail,
        message: `${toolName} 当前不可用(${engine.fallbackReason ?? 'unknown'}),请改用 search_files 做文本搜索。`,
        reason,
      },
      'plan',
    );

  const stDependencyMap = tool({
    name: 'st_dependency_map',
    description:
      '查询 ST 工作区的真实符号依赖关系(基于语言服务器语义解析,非文本搜索)。' +
      '不带参数返回工程地图(每个 .st 文件依赖哪些文件);带 path 返回该文件的依赖方与被依赖方、以及具体符号名。' +
      '修改任何 .st 文件前建议先查询,以了解会波及哪些文件;找不到某个变量/功能块的定义时也可用它定位。',
    parameters: z.object({
      path: z.string().optional().describe('工作区内的 .st 文件路径;留空返回整个工作区的依赖摘要'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: requestedPath }, _toolContext, details) =>
      guard(
        async () => {
          if (!workspace.primaryRoot) {
            return failed(new Error('未打开工作区文件夹,依赖图不可用'), 'plan');
          }
          const collected = await collectWorkspaceFiles();
          if (!collected.files.length) {
            return failed(new Error('工作区内没有 .st 文件'), 'plan');
          }
          const graph = await stAnalyzer.dependencyGraph(
            { workspaceRoot: workspace.primaryRoot, files: collected.files },
            { signal: details?.signal },
          );
          if (graph.engine.id !== 'st-analyze') {
            return degraded('st_dependency_map', graph.engine, '依赖图需要真实 ST 语言服务');
          }

          const base = {
            engine: graph.engine.id,
            analyzedFiles: graph.files.length,
            edgeCount: graph.edges.length,
            elapsedMs: graph.elapsedMs,
            contextTruncated: collected.truncated,
          };

          if (requestedPath) {
            const resolved = workspace.resolve(requestedPath);
            const target = resolved.absolutePath;
            const dependsOn = graph.edges.filter((edge) => edge.from === target);
            const dependents = graph.edges.filter((edge) => edge.to === target);
            const unresolvedHere = graph.unresolved.filter((item) => item.file === target);
            return contract(
              {
                ...base,
                file: toDisplay(target),
                dependsOn: dependsOn.slice(0, MAX_LISTED).map((edge) => ({
                  file: toDisplay(edge.to),
                  symbols: edge.symbols.slice(0, MAX_LISTED),
                  kind: edge.kinds.join('+'),
                })),
                dependents: dependents.slice(0, MAX_LISTED).map((edge) => ({
                  file: toDisplay(edge.from),
                  symbols: edge.symbols.slice(0, MAX_LISTED),
                  kind: edge.kinds.join('+'),
                })),
                ...(dependsOn.length > MAX_LISTED || dependents.length > MAX_LISTED
                  ? { truncated: true }
                  : {}),
                ...(unresolvedHere.length ? { unresolvedReferences: unresolvedHere } : {}),
              },
              'plan',
            );
          }

          const perFile = new Map<string, Set<string>>();
          for (const edge of graph.edges) {
            if (!perFile.has(edge.from)) perFile.set(edge.from, new Set());
            perFile.get(edge.from)!.add(edge.to);
          }
          return contract(
            {
              ...base,
              files: graph.files.slice(0, MAX_LISTED).map(toDisplay),
              ...(graph.files.length > MAX_LISTED ? { filesTruncated: true } : {}),
              dependencies: [...perFile.entries()].slice(0, MAX_LISTED).map(([from, tos]) => ({
                file: toDisplay(from),
                dependsOn: [...tos].slice(0, MAX_LISTED).map(toDisplay),
              })),
              cycles: graph.cycles.slice(0, 10).map((group) => group.map(toDisplay)),
              unresolvedCount: graph.unresolved.length,
              unresolvedSamples: graph.unresolved.slice(0, 10).map((item) => ({
                file: toDisplay(item.file),
                symbol: item.symbol,
                count: item.count,
              })),
              externalLibraryReferences: graph.externalCount,
            },
            'plan',
          );
        },
        'plan',
      ),
  });

  const stChangeImpact = tool({
    name: 'st_change_impact',
    description:
      '评估改动一个 .st 文件(或其中特定符号)会波及哪些文件:返回直接依赖方与传递依赖方。' +
      '在修改 GVL / 功能块 / 类型定义之前调用,可以知道哪些程序可能需要同步复核。' +
      '传入 symbols 可做符号级评估(只关心这些符号的引用方)。',
    parameters: z.object({
      path: z.string().describe('要变更的 .st 文件路径(工作区内)'),
      symbols: z
        .array(z.string())
        .optional()
        .describe('可选:只关心该文件中的哪些符号(如某个全局变量名)'),
      granularity: z
        .enum(['file', 'symbol'])
        .optional()
        .describe('影响面粒度:file(默认,保守)或 symbol(需要 symbols 参数)'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: requestedPath, symbols, granularity }, _toolContext, details) =>
      guard(
        async () => {
          if (!workspace.primaryRoot) {
            return failed(new Error('未打开工作区文件夹,影响面分析不可用'), 'plan');
          }
          const resolved = workspace.resolve(requestedPath);
          if (!resolved.absolutePath.toLowerCase().endsWith('.st')) {
            return failed(new Error(`${resolved.relativePath} 不是 .st 文件`), 'plan');
          }
          const collected = await collectWorkspaceFiles();
          const hasTarget = collected.files.some((file) => file.path === resolved.absolutePath);
          if (!hasTarget) {
            return failed(
              new Error(
                `目标文件未被纳入分析池(可能超出文件数配额或不存在): ${resolved.relativePath}`,
              ),
              'plan',
            );
          }
          const impact = await stAnalyzer.changeImpact(
            {
              workspaceRoot: workspace.primaryRoot,
              files: collected.files,
              target: resolved.absolutePath,
              ...(symbols?.length ? { symbols } : {}),
              ...(granularity ? { granularity } : {}),
            },
            { signal: details?.signal },
          );
          if (impact.engine.id !== 'st-analyze') {
            return degraded('st_change_impact', impact.engine, '影响面分析需要真实 ST 语言服务');
          }
          return contract(
            {
              engine: impact.engine.id,
              target: toDisplay(impact.target),
              granularity: impact.granularity,
              directDependents: impact.directDependents.slice(0, MAX_LISTED).map(toDisplay),
              allDependents: impact.allDependents.slice(0, MAX_LISTED).map(toDisplay),
              ...(impact.allDependents.length > MAX_LISTED ? { truncated: true } : {}),
              ...(impact.bySymbol
                ? {
                    bySymbol: Object.fromEntries(
                      Object.entries(impact.bySymbol)
                        .slice(0, 20)
                        .map(([symbol, affected]) => [
                          symbol,
                          affected.slice(0, MAX_LISTED).map(toDisplay),
                        ]),
                    ),
                  }
                : {}),
              note: '受影响文件表示可能需要复核其引用,不代表必须修改。',
              elapsedMs: impact.elapsedMs,
            },
            'plan',
          );
        },
        'plan',
      ),
  });

  return { stDependencyMap, stChangeImpact };
}
