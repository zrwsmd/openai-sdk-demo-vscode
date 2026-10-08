# Agent Runtime 拆分计划

本文记录 `src/runtime/agent.ts` 的后续拆分顺序。当前目标不是改行为，而是把已经稳定的外围职责先搬出
`agent.ts`，让主执行循环更容易维护。

## 当前状态

- `src/runtime/agent.ts` 约 3584 行，约 139KB，是 `src/runtime` 下最大的文件。
- `runAgent()` 单函数约 1698 行，内部耦合了工具构建、审批恢复、Workflow、Completion Gate、
  Stream pump、usage 汇总和 session 投影。
- 直接切分 `runAgent()` 风险较高；优先抽取外围独立职责，保持原有导出兼容。

## 拆分原则

- 每个阶段只搬一个清晰职责，尽量不改业务行为。
- `agent.ts` 继续作为兼容导出入口，外部调用方暂时不需要批量改 import。
- 每阶段完成后跑对应测试，再更新本文进度。
- 先抽纯函数/独立服务，再处理 `runAgent()` 主循环。
- 不把 ST 领域逻辑重新写进公共 runtime；保持前面 Workflow 通用化的边界。

## 阶段顺序

### 1. 抽出网关与 Chat Completions 适配层

状态：已完成。

建议新增：

- `src/runtime/modelGateway.ts`

迁移内容：

- 已迁移 `GatewayGuardedModel`、`makeLoggingFetch`、
  `sanitizeChatCompletionRequestBody`、`summarizeOutgoing`、
  `summarizeNonStreamChatCompletionResponse`、`buildChatCompletionsModel`。
- 结构化输出和 `parallel_tool_calls` 能力降级相关的小工具函数也集中在新模块。
- 网关日志 setter 和 `EmptyGatewayResponseError` 由新模块持有。

保留方式：

- `agent.ts` 从新模块 re-export 原有公共符号，外部调用方不需要修改 import。
- `buildModelAdapter()` 在第 2 阶段随任务准备依赖迁移到 `modelGateway.ts`；`agent.ts`
  继续 re-export，`contextManager.ts` 直接从新模块 import。
- 网关能力协商状态仍按模型实例隔离，OpenAI client 继续按网关地址和 key 复用。

验证：

- `npm run compile`
- `npm run test:generate; node scripts/agent_kernel_test.mjs`
- `npm run test:batch`
- 已通过：`npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:jev`、`npm run test:agent`、`npm run test:batch`。

### 2. 抽出任务准备与通用判定

状态：已完成。

建议新增：

- `src/runtime/taskPreparation.ts`

迁移内容：

- `planTask`
- `classifyDeliveryContract`
- `classifyWorkflowDecision`
- `isSimpleSingleTurnRequest`

保留方式：

- `agent.ts` 继续 re-export 这些函数，外部调用方不需要修改 import。
- `buildModelAdapter()` 一并迁移到 `modelGateway.ts`，避免任务准备模块反向依赖
  `agent.ts`；`contextManager.ts` 已改为直接从网关模块 import。
- `runCoordinator.ts` 可暂时不改 import，等后续统一清理。

验证：

- `npm run compile`
- `npm run test:workflow`
- `npm run test:jev`
- `npm run test:batch`
- 已通过：`npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:jev`、`npm run test:batch`。

### 3. 抽出 Team 角色执行

建议新增：

- `src/runtime/teamAgent.ts`

迁移内容：

- `runTeamRoleRawOutput`
- `runTeamRole`
- `routeTeamTask`
- `planTeamTask`
- `reviewTeamTask`
- `verifyTeamTask`
- Team 角色 schema 修复、JSON 解析和角色输出 coercion 相关函数

保留方式：

- `agent.ts` 继续 re-export Team 函数。
- `runCoordinator.ts` 可保持原 import，下一轮再改。

验证：

- `npm run compile`
- `npm run test:generate; node scripts/run_coordinator_test.mjs`
- `npm run test:batch`

### 4. 抽出 Session 历史与工具历史投影

建议新增：

- `src/runtime/agentHistory.ts`

迁移内容：

- `sessionOutputText`
- `loadHistoricalToolResults`
- `toolNameOf`
- `isToolHistoryItem`
- `projectNewTurnSessionHistory`
- `composeToolSet`
- `renderAvailableToolsPrompt`

注意：

- `composeToolSet` 和 `renderAvailableToolsPrompt` 依赖工具目录提示词，迁移时要保留
  runtime 控制工具不受业务 allowlist 限制的语义。

验证：

- `npm run compile`
- `npm run test:generate; node scripts/agent_kernel_test.mjs`
- `npm run test:workflow`

### 5. 抽出错误、恢复与写入验证工具

建议新增：

- `src/runtime/agentErrors.ts`
- `src/runtime/workspaceWriteVerification.ts`

迁移内容：

- `EmptyGatewayResponseError`
- `AgentActionVerificationError`
- `attachResumableAgentState`
- `getResumableAgentState`
- `isRetryableAgentError`
- `isAgentCancellationError`
- `verifyWorkspaceWrite`

保留方式：

- `agent.ts` re-export 外部测试和 `runCoordinator.ts` 依赖的符号。

验证：

- `npm run compile`
- `npm run test:generate; node scripts/sdk_foundation_test.mjs`
- `npm run test:generate; node scripts/agent_kernel_test.mjs`
- `npm run test:batch`

### 6. 收敛 `runAgent()` 主循环内部结构

前五阶段完成后，再评估 `runAgent()`。届时它应该只剩核心执行循环和少量 glue code。

可拆方向：

- 工具集合构建：工具注册、Workflow 工具策略、运行时控制工具。
- Tool ledger：工具调用、工具结果、风险和 evidence 记录。
- Completion Gate repair loop：完成判定、修复工具选择、重试次数控制。
- Approval resume loop：审批中断、恢复、RunState 序列化。
- Stream pump：SDK stream 消费、输出投影、usage 汇总。

这阶段风险最高，只有在前面阶段测试稳定后再做。

验证：

- `npm run compile`
- `npm run test:generate`
- `npm run test:batch`
- `npm run test:workflow`
- `npm run test:st`
- `npm run test:jev`

## 完成标准

- `agent.ts` 仍保留 `runAgent()` 和兼容导出，但不再承载网关、Team、判定、历史投影等大块实现。
- `runCoordinator.ts`、`contextManager.ts`、测试脚本可以逐步改为从新模块直接 import。
- 新增模块职责单一，测试仍通过。
- `agent.ts` 行数显著下降，后续再拆 `runAgent()` 时不会同时牵动外围能力。
