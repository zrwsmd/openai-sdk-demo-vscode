/**
 * ST 标准库符号查询工具。
 *
 * 与依赖图 / 影响面 / 符号引用三个工具的分工:那三个回答"当前工作区里有什么",
 * 本工具回答"语言本身提供了什么" —— IEC 61131-3 标准功能块 / 函数 / 类型的接口定义。
 * 数据来自随引擎分发的标准符号表,不读工作区文件、不需要语言服务、不产生任何副作用。
 *
 * 只做大小写不敏感的精确匹配:查不到就如实说 0 条,由模型换个名字再问。
 * 不做模糊搜索 —— "最接近的几条"会把模型带向一个它原本没问的符号。
 *
 * 与 workspaceReadTools / dependencyTools 同一形态:工厂函数 + 薄壳工具,
 * 基建(guard、审批策略、审计、降级)复用 ToolBuildContext。
 */
import { z } from 'zod';
import { tool } from '@openai/agents';
import type { StToolBuildContext } from '../stToolContext';

/** 回执里最多列出的同名字号条数:同名多用途时靠签名区分,超出只报计数 */
const MAX_ENTRIES = 8;

/** 模型给必填参数填的占位串("None"/"null" 之类):一律按"没给"处理 */
function isPlaceholderText(value: string): boolean {
  return /^(none|null|undefined|n\/?a)$/i.test(value.trim());
}

export function createStLibraryTools(context: StToolBuildContext) {
  const { stAnalyzer, guard, contract, failed, guardrails } = context;

  const stLibrarySymbol = tool({
    name: 'st_library_symbol',
    description:
      '查询 IEC 61131-3 标准库符号(功能块 / 函数 / 类型 / 枚举)的接口定义:输入输出参数及其类型、说明、调用签名。' +
      '当用户问 TON、TOF、CTU、SR、ADD、SEL、MUX 这类标准功能块的引脚、用法、返回值时使用;' +
      '它查的是语言标准库,不是当前工作区里的代码 —— 要查工作区里声明或引用的符号请改用 st_symbol_references。' +
      'symbol 必须精确匹配(大小写不敏感,如 ADD / TON / MC_Power),不支持模糊搜索;' +
      '查不到时返回 matchCount=0,此时应核对拼写或换用 st_symbol_references,不要用同一个名字反复重试。' +
      '同名符号可能有多条(如 ADD 在数值加法、时间加法下各有一条),返回里用 inputs/outputs 的类型签名区分用途。',
    parameters: z.object({
      symbol: z
        .string()
        .describe('标准库符号名,大小写不敏感,如 ADD / TON / MC_Power'),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ symbol }, _toolContext, details) =>
      guard(
        async () => {
          const name = typeof symbol === 'string' ? symbol.trim() : '';
          if (!name || isPlaceholderText(name)) {
            return failed(
              new Error('symbol 不能为空,请给出标准库符号名(如 ADD / TON / MC_Power)'),
              'plan',
            );
          }
          const result = await stAnalyzer.libraryLookup(
            { symbol: name },
            { signal: details?.signal },
          );
          if (result.engine.id !== 'st-analyze') {
            return contract(
              {
                engine: result.engine.id,
                fallbackReason: result.engine.fallbackReason,
                detail: result.engine.detail,
                message: `标准库查询当前不可用(${result.engine.fallbackReason ?? 'unknown'})。`,
                reason: '标准库符号表随 ST 语言服务分发,降级实现读不到它',
              },
              'plan',
            );
          }

          const entries = result.entries.slice(0, MAX_ENTRIES);
          return contract(
            {
              engine: result.engine.id,
              symbol: result.symbol,
              matchCount: result.matchCount,
              ...(result.matchCount > entries.length ? { truncated: true } : {}),
              entries,
              ...(result.matchCount === 0
                ? {
                    hint:
                      '标准库里没有这个名字。请核对拼写;若是工作区里自定义的符号,改用 st_symbol_references。',
                  }
                : {}),
              elapsedMs: result.elapsedMs,
            },
            'plan',
          );
        },
        'plan',
      ),
  });

  return { stLibrarySymbol };
}
