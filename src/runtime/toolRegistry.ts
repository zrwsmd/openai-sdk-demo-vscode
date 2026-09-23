import type { DeliveryWorkflow } from "./deliveryWorkflow";
import {
  createStValidationState,
  type StValidationState,
} from "./workflows/stWorkspaceDeliveryWorkflow";
import type { DeliveryContract } from "./deliveryContract";
import type { AgentConfig } from "./agentConfig";
import {
  commandToolResult,
  createToolBuildContext,
  TOOL_RISK_BY_NAME,
  type DiagnosticSideReporter,
  type RuntimeToolCallGuard,
} from "./tools/toolBuildContext";
import { createWorkspaceReadTools } from "./tools/workspaceReadTools";
import { createValidateStTools } from "./tools/validateStTool";
import { createWriteFileTool } from "./tools/writeFileTool";
import { createRunCommandTool } from "./tools/runCommandTool";
import { createStGraphTools } from "./tools/dependencyTools";

export {
  commandToolResult,
  TOOL_RISK_BY_NAME,
  type DiagnosticSideReporter,
  type RuntimeToolCallGuard,
};

export function buildTools(
  cfg: AgentConfig,
  deliveryContract?: DeliveryContract,
  deliveryWorkflow?: DeliveryWorkflow,
  stValidationState: StValidationState = createStValidationState(),
  diagnosticReporter?: DiagnosticSideReporter,
  runtimeToolGuard?: RuntimeToolCallGuard,
) {
  const context = createToolBuildContext(
    cfg,
    deliveryContract,
    deliveryWorkflow,
    stValidationState,
    diagnosticReporter,
    runtimeToolGuard,
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
  const { stDependencyMap, stChangeImpact, stSymbolReferences } = createStGraphTools(context);

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
    stDependencyMap,
    stChangeImpact,
    stSymbolReferences,
  ];
  if (workflowToolNames) {
    return allTools.filter((item) => {
      const name = (item as unknown as { name?: unknown }).name;
      return typeof name === "string" && workflowToolNames.has(name);
    });
  }
  return allTools;
}
