import {
  createStValidationState,
  type DeliveryWorkflow,
  type StValidationState,
} from "./deliveryWorkflow";
import type { DeliveryContract } from "./deliveryContract";
import type { AgentConfig } from "./agentConfig";
import {
  commandToolResult,
  createToolBuildContext,
  TOOL_RISK_BY_NAME,
  type DiagnosticSideReporter,
} from "./tools/toolBuildContext";
import { createWorkspaceReadTools } from "./tools/workspaceReadTools";
import { createValidateStTools } from "./tools/validateStTool";
import { createWriteFileTool } from "./tools/writeFileTool";
import { createRunCommandTool } from "./tools/runCommandTool";

export {
  commandToolResult,
  TOOL_RISK_BY_NAME,
  type DiagnosticSideReporter,
};

export function buildTools(
  cfg: AgentConfig,
  deliveryContract?: DeliveryContract,
  deliveryWorkflow?: DeliveryWorkflow,
  stValidationState: StValidationState = createStValidationState(),
  diagnosticReporter?: DiagnosticSideReporter,
) {
  const context = createToolBuildContext(
    cfg,
    deliveryContract,
    deliveryWorkflow,
    stValidationState,
    diagnosticReporter,
  );
  const workflowToolNames = deliveryWorkflow?.visibleToolNames
    ? new Set(deliveryWorkflow.visibleToolNames)
    : undefined;
  const {
    getIoTable,
    readPlcVariables,
    listFilesTool,
    readFileTool,
    searchFilesTool,
  } = createWorkspaceReadTools(context);
  const {
    validateStCode,
    validateStContentBeforeWrite,
    exportStProgram,
  } = createValidateStTools(context);
  const writeFileTool = createWriteFileTool(
    context,
    validateStContentBeforeWrite,
  );
  const runCommandTool = createRunCommandTool(context);

  const allTools = [
    getIoTable,
    readPlcVariables,
    validateStCode,
    exportStProgram,
    listFilesTool,
    readFileTool,
    searchFilesTool,
    writeFileTool,
    runCommandTool,
  ];
  if (workflowToolNames) {
    return allTools.filter((item) => {
      const name = (item as unknown as { name?: unknown }).name;
      return typeof name === "string" && workflowToolNames.has(name);
    });
  }
  return allTools;
}
