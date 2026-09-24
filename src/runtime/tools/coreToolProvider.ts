import type { Tool } from "@openai/agents";
import type { ToolRisk } from "../../tools/toolContract";
import type { ToolProvider } from "../toolRegistry";
import { createRunCommandTool } from "./runCommandTool";
import { createWorkspaceReadTools } from "./workspaceReadTools";
import { createWriteFileTool } from "./writeFileTool";

const CORE_TOOL_RISKS: Readonly<Record<string, ToolRisk>> = {
  get_io_table: "read",
  read_plc_variables: "read",
  list_files: "read",
  read_file: "read",
  search_files: "read",
  write_file: "write",
  run_command: "execute",
};

export function createCoreToolProvider(): ToolProvider {
  return {
    id: "core",
    riskByTool: CORE_TOOL_RISKS,
    evidenceByTool: {
      write_file: ["successful_write"],
    },
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
        createRunCommandTool(context),
      ];
    },
  };
}
