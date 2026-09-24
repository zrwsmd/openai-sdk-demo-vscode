import { tool } from "@openai/agents";
import { z } from "zod";
import {
  listFiles,
  readFileRange,
  searchText,
} from "../../tools/workspaceTools";
import {
  defaultedIntParam,
  parseOptionalInt,
  type ToolBuildContext,
} from "./toolBuildContext";

export function createWorkspaceReadTools(ctx: ToolBuildContext) {
  const { contract, failed, guard, guardrails, plc, workspace } = ctx;

  const getIoTable = tool({
    name: "get_io_table",
    description: "查询当前 PLC 项目的 I/O 变量表。",
    parameters: z.object({}),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async () => {
      try {
        return contract(
          { adapter: plc.id, variables: await plc.getIoTable() },
          "read",
        );
      } catch (error) {
        return failed(error, "read");
      }
    },
  });

  const readPlcVariables = tool({
    name: "read_plc_variables",
    description:
      "从已配置的 PLC 适配器读取指定变量的当前值，只读且不改变设备状态。",
    parameters: z.object({
      names: z.array(z.string()).min(1).describe("要读取的 PLC 变量名"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: async ({ names }) => {
      try {
        return contract(
          { adapter: plc.id, variables: await plc.readVariables(names) },
          "read",
        );
      } catch (error) {
        return failed(error, "read");
      }
    },
  });

  const listFilesTool = tool({
    name: "list_files",
    description:
      "列出当前工作区内的文件(相对根目录,自动跳过 node_modules/.git/dist 等)。参数 dir 为相对子目录,默认根目录。",
    parameters: z.object({
      dir: z.string().optional().describe("相对子目录,留空表示工作区根"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ dir }) =>
      guard(
        async () =>
          contract(
            { files: await listFiles(workspace.primaryRoot, dir ?? ".") },
            "read",
          ),
        "read",
      ),
  });

  const readFileTool = tool({
    name: "read_file",
    description:
      "读取已授权工作区内一个文本文件的内容。相对路径默认使用当前工作区，也可使用其他已授权工作区的绝对路径。" +
      "读取全文时传 startLine=1、endLine=0;需要分段读取大文件时传起止行号。" +
      "结果 data.complete/data.truncated 明确表示是否完整读取；data.fileContentHash 是完整文件哈希。" +
      "界面可能只展示 content 的摘要，摘要省略不代表文件被截断。",
    parameters: z.object({
      path: z.string().describe("相对工作区的文件路径"),
      startLine: defaultedIntParam(1).describe(
        "起始行(1 起),整数;读取全文时传 1,分段读取时传正整数",
      ),
      endLine: defaultedIntParam(0).describe(
        "结束行(含),整数;读取全文时传 0 表示读到文件末尾,分段读取时传正整数",
      ),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ path: p, startLine, endLine }) =>
      guard(async () => {
        const target = workspace.resolve(p);
        const s = parseOptionalInt(startLine) ?? 1;
        const e = parseOptionalInt(endLine);
        const r = await readFileRange(target.root, target.relativePath, s, e);
        return contract({
          path: target.relativePath,
          content: r.text,
          totalLines: r.totalLines,
          startLine: r.startLine,
          endLine: r.endLine,
          returnedLines: r.returnedLines,
          totalBytes: r.totalBytes,
          returnedBytes: r.returnedBytes,
          complete: r.complete,
          truncated: r.truncated,
          fileContentHash: r.fileContentHash,
          returnedContentHash: r.returnedContentHash,
        }, "read");
      }, "read"),
  });

  const searchFilesTool = tool({
    name: "search_files",
    description:
      '在工作区文件里做文本搜索,返回 "相对路径:行号: 内容"。支持 glob 文件名过滤(如 *.ts)与 isRegex 正则。',
    parameters: z.object({
      text: z.string().describe("要搜索的字面量或正则"),
      glob: z.string().optional().describe("按文件名过滤,如 *.ts"),
      isRegex: z.boolean().optional().describe("是否按正则解析 text"),
    }),
    inputGuardrails: guardrails.input,
    outputGuardrails: guardrails.output,
    execute: ({ text, glob, isRegex }) =>
      guard(
        async () =>
          contract(
            {
              matches: await searchText(workspace.primaryRoot, text, {
                glob,
                isRegex,
              }),
            },
            "read",
          ),
        "read",
      ),
  });

  return {
    getIoTable,
    readPlcVariables,
    listFilesTool,
    readFileTool,
    searchFilesTool,
  };
}
