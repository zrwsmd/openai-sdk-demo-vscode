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
      '修改任何 .st 文件前建议先查询,以了解会波及哪些文件。' +
      '若要定位某个具体符号的声明位置与全部使用行,请改用 st_symbol_references。',
    parameters: z.object({
      path: z
        .string()
        .optional()
        .describe(
          '工作区内的 .st 文件路径(如 st-refs/MainProgram.st);省略或留空表示返回整个工作区的依赖摘要,不要填 None/null 之类的占位值',
        ),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: requestedPath }, _toolContext, details) =>
      guard(
        async () => {
          if (!workspace.primaryRoot) {
            return failed(new Error('未打开工作区文件夹,依赖图不可用'), 'plan');
          }
          // 模型偶尔给可选参数填 "None"/"null" 这类占位串:按"未提供"处理。
          // 否则会拿它去查一个不存在的文件,返回空 dependsOn/dependents,
          // 看起来像"这个工程没有依赖",而实际是路径没对上。
          const asked = typeof requestedPath === 'string' ? requestedPath.trim() : '';
          const pathArg = /^(none|null|undefined|n\/?a)$/i.test(asked) ? '' : asked;
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

          if (pathArg) {
            const resolved = workspace.resolve(pathArg);
            // 与 edges 的 from/to 同源比较(它们就是请求里的 path 原样回传),
            // 大小写/分隔符差异统一后再比,避免"文件其实在池里却匹配不上边"。
            const normalize = (value: string) => value.split(path.sep).join('/').toLowerCase();
            const target = graph.files.find(
              (file) => normalize(file) === normalize(resolved.absolutePath),
            );
            if (!target) {
              return failed(
                new Error(
                  `指定的文件不在本次分析池内: ${pathArg}。` +
                    `可能是路径写错、文件不存在,或超出上下文文件配额。` +
                    `本次实际分析的文件: ${graph.files.map(toDisplay).join(', ')}`,
                ),
                'plan',
              );
            }
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
      '传入 symbols 可做符号级评估(只关心这些符号的引用方);' +
      '注意 symbols 只看跨文件引用,若要包含同一文件内的本地变量引用,请用 st_symbol_references。',
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

  const stSymbolReferences = tool({
    name: 'st_symbol_references',
    description:
      '查询某个符号(变量 / 功能块 / 类型 / 程序)声明在哪、被哪些文件的哪一行引用,基于语言服务器语义解析。' +
      '与 st_dependency_map 的分工:后者给文件级依赖(谁依赖谁),本工具给符号级明细(具体符号在哪些行被用到),' +
      '因此能覆盖同一文件内部的本地变量引用。' +
      '改名、删除、修改某个符号的接口前调用它,可以一次拿到全部引用点。' +
      '同名符号(不同文件里各有一个同名变量)会分组返回;用 path 可把结果限定在某个文件的声明上。',
    parameters: z.object({
      symbol: z.string().describe('要查询的符号名(区分大小写,与源码一致,如 MainMotor / FB_MotorControl)'),
      path: z
        .string()
        .optional()
        .describe('可选:把声明限定在某个 .st 文件内,用于同名符号消歧'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ symbol, path: requestedPath }, _toolContext, details) =>
      guard(
        async () => {
          if (!workspace.primaryRoot) {
            return failed(new Error('未打开工作区文件夹,符号引用查询不可用'), 'plan');
          }
          const name = symbol.trim();
          if (!name) {
            return failed(new Error('symbol 不能为空'), 'plan');
          }
          let pathFilter: string | undefined;
          if (requestedPath) {
            const resolved = workspace.resolve(requestedPath);
            if (!resolved.absolutePath.toLowerCase().endsWith('.st')) {
              return failed(new Error(`${resolved.relativePath} 不是 .st 文件`), 'plan');
            }
            pathFilter = resolved.absolutePath;
          }
          const collected = await collectWorkspaceFiles();
          if (!collected.files.length) {
            return failed(new Error('工作区内没有 .st 文件'), 'plan');
          }
          const result = await stAnalyzer.findSymbolReferences(
            {
              workspaceRoot: workspace.primaryRoot,
              files: collected.files,
              symbol: name,
              ...(pathFilter ? { path: pathFilter } : {}),
            },
            { signal: details?.signal },
          );
          if (result.engine.id !== 'st-analyze') {
            return degraded('st_symbol_references', result.engine, '符号引用查询需要真实 ST 语言服务');
          }

          const totalReferences = result.declarations.reduce(
            (sum, declaration) => sum + declaration.referenceCount,
            0,
          );
          const declarations = result.declarations.slice(0, 20).map((declaration) => ({
            file: toDisplay(declaration.file),
            name: declaration.name,
            type: declaration.type,
            line: declaration.line,
            character: declaration.character,
            referenceCount: declaration.referenceCount,
            references: declaration.references.slice(0, MAX_LISTED).map((reference) => ({
              file: toDisplay(reference.file),
              line: reference.line,
              character: reference.character,
            })),
          }));

          // 零声明有两种原因(限定文件内没有 / 全池都没有),给模型不同的下一步提示,
          // 避免它把"查不到声明"直接当成"这个符号没有引用"。
          const hint = result.declarationCount
            ? totalReferences === 0
              ? '该符号已声明但当前分析池内没有任何引用点。'
              : undefined
            : pathFilter
              ? `指定文件内没有名为 ${name} 的声明;去掉 path 可查询整个工作区。`
              : `分析池内没有名为 ${name} 的声明(可能是外部库符号,或名字/大小写不符)。`;

          return contract(
            {
              engine: result.engine.id,
              symbol: result.symbol,
              declarationCount: result.declarationCount,
              referenceCount: totalReferences,
              analyzedFiles: collected.files.length,
              contextTruncated: collected.truncated,
              declarations,
              ...(result.truncated ? { truncated: true } : {}),
              ...(hint ? { hint } : {}),
              note: 'references 是符号的实际使用点(1 起行列号);引用点所在的文件可能需要同步复核。',
              elapsedMs: result.elapsedMs,
            },
            'plan',
          );
        },
        'plan',
      ),
  });

  return { stDependencyMap, stChangeImpact, stSymbolReferences };
}
