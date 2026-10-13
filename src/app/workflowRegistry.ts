import {
  setDefaultWorkflowRegistry,
  WorkflowRegistry,
} from "../runtime/workflow/registry";
import { ST_WORKSPACE_DELIVERY_WORKFLOW } from "../runtime/plugins/st/stWorkspaceDeliveryWorkflow";
import { DEVUNI_PROJECT_WORKFLOW } from "../runtime/plugins/devuni/devuniProjectWorkflow";

/**
 * Application composition root for the built-in workflow plugins.
 *
 * The runtime registry itself is domain-neutral; this host decides which
 * plugins are available in the VS Code extension.
 */
export function createAppWorkflowRegistry(): WorkflowRegistry {
  // 顺序即优先级:本地规则按注册顺序遍历,谁先认领谁赢。
  // 代码交付那条线必须排在工程事务前面,因为"建个工程然后写个程序"这类
  // 跨域请求只能由带交付契约的那条线接走,工程事务那条线没有收尾判定。
  const registry = new WorkflowRegistry([
    ST_WORKSPACE_DELIVERY_WORKFLOW,
    DEVUNI_PROJECT_WORKFLOW,
  ]);
  setDefaultWorkflowRegistry(registry);
  return registry;
}
