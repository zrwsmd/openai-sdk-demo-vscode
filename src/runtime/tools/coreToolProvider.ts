import type { Tool } from "@openai/agents";
import type { ToolProvider } from "../toolRegistry";
import type { ToolCapability } from "../toolCatalog";
import { createRunCommandTool } from "./runCommandTool";
import { createWorkspaceReadTools } from "./workspaceReadTools";
import { createWriteFileTool } from "./writeFileTool";
import { createEditFileTool } from "./editFileTool";

const CORE_TOOL_CAPABILITIES: readonly ToolCapability[] = [
  {
    name: "get_io_table",
    description: "查询 PLC 项目的 I/O 变量表。",
    domain: "plc",
    intents: ["查询 I/O", "查看变量表", "读取 PLC 项目变量"],
    tags: ["plc", "read", "io"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  {
    name: "read_plc_variables",
    description: "读取已配置 PLC 适配器中的变量当前值。",
    domain: "plc",
    intents: ["读取 PLC 变量", "查询变量当前值", "查看设备变量"],
    tags: ["plc", "read", "variables"],
    risk: "read",
    effect: "device",
    fallbackModes: ["read_only"],
  },
  {
    name: "list_files",
    description: "列出授权工作区内的文件。",
    domain: "workspace",
    intents: ["列出文件", "查看工作区文件", "浏览目录"],
    tags: ["workspace", "read", "files"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only", "file_edit"],
  },
  {
    name: "read_file",
    description: "读取授权工作区内文本文件的内容。",
    domain: "workspace",
    intents: ["读取文件", "查看文件内容", "打开文件"],
    tags: ["workspace", "read", "files"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only", "file_edit"],
  },
  {
    name: "search_files",
    description: "在授权工作区文件中搜索文本或正则表达式。",
    domain: "workspace",
    intents: ["搜索文件", "查找文本", "查找引用"],
    tags: ["workspace", "read", "search"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only", "file_edit"],
  },
  {
    name: "write_file",
    description: "向授权工作区文件写入完整文本内容。",
    domain: "workspace",
    intents: ["写入文件", "创建文件", "保存文件"],
    tags: ["workspace", "write", "files"],
    risk: "write",
    effect: "filesystem",
    evidence: ["successful_write"],
    fallbackModes: ["file_edit"],
  },
  {
    name: "edit_file",
    description: "对授权工作区已有文本文件执行精确编辑并返回 diff。",
    domain: "workspace",
    intents: ["编辑文件", "修改文件", "替换文本"],
    tags: ["workspace", "write", "diff"],
    risk: "write",
    effect: "filesystem",
    evidence: ["successful_write"],
    fallbackModes: ["file_edit"],
  },
  {
    name: "run_command",
    description: "在授权工作区根目录执行命令。",
    domain: "workspace",
    intents: ["运行命令", "执行脚本", "检查工程"],
    tags: ["workspace", "execute", "command"],
    risk: "execute",
    effect: "process",
  },
];

export function createCoreToolProvider(): ToolProvider {
  return {
    id: "core",
    capabilities: CORE_TOOL_CAPABILITIES,
    createTools(context): readonly Tool[] {
      const {
        getIoTable,
        readPlcVariables,
        listFilesTool,
        readFileTool,
        searchFilesTool,
      } = createWorkspaceReadTools(context);
      return [
        getIoTable,
        readPlcVariables,
        listFilesTool,
        readFileTool,
        searchFilesTool,
        createWriteFileTool(context),
        createEditFileTool(context),
        createRunCommandTool(context),
      ];
    },
  };
}
