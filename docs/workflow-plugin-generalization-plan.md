# Workflow 插件通用化重构实施文档

## 总目标

把当前运行时改成真正的通用 Workflow Plugin 架构：

```text
公共 Agent Runtime
  ├── Workflow Registry
  ├── Workflow Decision
  ├── Tool Registry
  ├── Completion Gate
  ├── Approval / Resume
  ├── Pipeline Runtime
  └── Generic Runtime Services

插件层
  ├── ST Delivery Plugin
  ├── ST Inspection Plugin
  └── 后续 JSON、文件编辑、配置修改等插件
```

硬性验收标准：

- 公共运行时核心不得导入 ST 分析模块。
- 公共运行时核心不得出现 `validate_st_code`、`export_st_program`、`stAnalyzer`、`.st`、`isSt...` 等 ST 业务判断。
- 公共层不得根据 ST 文件类型决定验证、完成、修复或工具顺序。
- ST 逻辑只能存在于 ST 插件、ST 工具提供者、ST 分析适配器和宿主装配层。
- 新增一个非 ST Workflow 时，不得修改 `agent.ts`、`completionGate.ts`、`toolRegistry.ts` 的业务逻辑。
- 现有 ST 校验、依赖分析、审批、断点恢复、Jev 路由行为保持不变。

## 实施进度

- [x] 0. 建立基线与边界检查
- [x] 1. 抽出真正通用的 Workflow 核心接口
- [x] 2. 把 Registry 改成注入式，移除公共层对 ST 插件的直接依赖
- [x] 3. 把 Jev、规则、模型判定统一到通用 Workflow 决策链
- [x] 4. 重构工具注册机制，公共层只认识通用 Tool Provider
- [x] 5. 让 `write_file` 变成真正通用的文件工具
- [x] 6. 重构 Completion Gate，移除所有 ST 完成逻辑
- [x] 7. 移除 Agent 和 Coordinator 中的 ST 状态及 ST 配置
- [x] 8. 迁移 ST 功能为正式插件
- [x] 9. 用非 ST Workflow 验证通用性
- [x] 10. 清理兼容层并完成边界封锁
- [x] 11. 增量阶段：文件级 `beforeEffect`、`ToolCatalog` 全覆盖 fallback、动态边界扫描、只读领域工具接入
- [x] 12. 增量阶段：通用多意图 `ToolCatalog` 能力选择

## 0. 基线与边界

公共核心审计范围：

- `src/runtime/agent.ts`
- `src/runtime/runCoordinator.ts`
- `src/runtime/completionGate.ts`
- `src/runtime/deliveryContract.ts`
- `src/runtime/toolRegistry.ts`
- `src/runtime/tools/toolBuildContext.ts`
- `src/runtime/workflow/*`
- `src/runtime/pipeline/*`
- `src/runtime/runStore.ts`
- `src/protocol/*`

边界测试必须确保公共核心不依赖领域插件。插件通过 Registry、Tool Provider 和服务容器接入。

## 1. 通用 Workflow 核心接口

统一 `WorkflowDescriptor`、`WorkflowRuntime`、`WorkflowRegistry`、`WorkflowDecision`、
`WorkflowRuntimeContext`、`WorkflowCompletionAdapter`、`WorkflowToolPolicy` 和
`WorkflowState`。公共运行时只调用这些接口，不解释插件业务语义。

## 2. 注入式 Registry

Registry 改成可注册实例。宿主装配层负责注册 ST Delivery 和 ST Inspection；
公共决策服务只接收 Registry，不直接导入 ST 插件。

## 3. 通用决策链

保留 Jev -> 本地匹配 -> 模型分类 -> 通用 fallback 的优先级。ST 契约推断和 ST
路由语义全部移入 ST 插件。

## 4. 通用 Tool Provider

工具注册改成 Provider 机制。公共层只管理工具生命周期、过滤、审批、审计和回执；
ST 校验、导出、依赖图、影响面和符号引用工具由 ST Provider 提供。

## 5. 通用文件写入

文件写入工具只负责路径边界、审批、写入、哈希和通用回执。领域验证通过通用
`beforeEffect` 钩子注入，不在公共工具中判断文件类型；钩子既可以按具体工具注册，
也可以按通用 `resourceKind: "file"` + `effect: "filesystem"` 注册。

## 6. 通用 Completion Gate

Completion Gate 只处理通用工具事实、交付契约证据和插件提供的 Completion Adapter；
不再直接判断 ST 契约、ST 工具名、文件扩展名或 ST 哈希。

## 7. Agent / Coordinator 解耦

Agent 和 Coordinator 只接收通用 Runtime Environment、服务容器、Registry 和
Tool Provider。ST 分析器由宿主作为服务注入，公共层不读取或解释 ST 配置。

本阶段已完成：

- 新增 `src/runtime/services.ts`，公共层只提供不透明的 `RuntimeServiceContainer`。
- `AgentConfig` 移除 `StAnalyzer` / `StAnalyzerToolOptions` 字段，改为通用 `services`。
- `RunCoordinator` 移除 `createStAnalyzer` 和 ST 配置读取，改为注入
  `createRuntimeServices(config)`。
- `DurableRunConfig` 移除 ST 专用持久化字段，改为可 JSON 持久化的 `extensions`；
  旧 `stAnalyzerSettings` 仅由宿主适配层兼容读取，不进入公共运行时判断。
- `analyzerHost` 负责把当前 ST 分析器和工具配额装配成服务；`chatView` 只负责注册宿主
  工厂和保存扩展配置。
- `agent.ts` 的验证和成功回执兜底改为读取 workflow / 工具回执提供的通用信息，不再
  判断 ST 工具名或 ST 文件类型。
- `src/runtime` 核心边界扫描通过；未修改 `src/analysis/*` 或 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:batch` 通过。
- `npm run test:agent` 通过（含 mock gateway、断点恢复和工具回执兜底）。
- `npm run test:st`、`npm run test:workflow`、`npm run test:jev` 通过。

## 8. ST 正式插件

将现有 ST Delivery、ST Inspection、ST 工具、ST 状态、ST 契约和 ST Completion
Adapter 收拢到 `src/runtime/plugins/st/`。`src/analysis/*` 和桥实现保持不变。

本阶段已完成：

- 新增正式插件目录 `src/runtime/plugins/st/`。
- ST Delivery、ST Inspection、ST 交付契约、Pipeline、运行时状态和内容哈希已迁入插件目录。
- `validate_st_code`、`export_st_program`、依赖图、影响面和符号引用工具已迁入
  `src/runtime/plugins/st/tools/`。
- ST Provider、ST Tool Context 和 ST Workflow 直接在插件目录内组装。
- 宿主的 Workflow Registry、Tool Registry 和分析器服务装配直接引用正式插件目录。
- 原 `src/runtime/workflows/*`、`src/runtime/tools/*` 和 `src/runtime/pipeline/*` 的 ST
  路径保留为纯 re-export 兼容层，不包含业务实现，便于历史测试和宿主调用平滑迁移。
- 未修改 `src/analysis/*` 和 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:batch` 通过。
- `npm run test:agent` 通过（含 mock gateway、ST 交付、审批、兜底和断点恢复）。
- `npm run test:st`、`npm run test:workflow`、`npm run test:jev` 通过。

## 9. 非 ST Workflow 验证

增加只读的 `generic_file_inspection` 测试插件，验证不修改公共核心也能注册、
路由、执行、验收和恢复。

本阶段已完成：

- 新增 `src/runtime/plugins/testing/genericFileInspectionWorkflow.ts`，作为非 ST、只读、
  领域中立的测试 workflow 插件。
- 插件只声明 `list_files`、`read_file`、`search_files` 三个可见工具，不注册任何 ST
  工具，也不依赖 ST 插件。
- 新增 `scripts/generic_workflow_test.mjs`，验证：
  - 注入式 `WorkflowRegistry` 可选择非 ST workflow。
  - workflow 可见工具被限制为三个只读文件工具。
  - Completion Gate 能基于通用工具回执完成验收。
  - 通用 workflow state 可通过 `createRuntime` / `hydrate` 恢复。
- `npm run test:workflow` 已包含该非 ST workflow 回归。
- 本阶段未修改 `agent.ts`、`completionGate.ts`、`toolRegistry.ts` 的业务逻辑。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:workflow` 通过。
- `npm run test:batch` 通过。
- `npm run test:agent` 通过（含 mock gateway）。
- `npm run test:st`、`npm run test:jev` 通过。

## 10. 清理与封锁

删除无调用方的旧兼容接口，保留必要的外部兼容导出；边界扫描进入测试命令，
确保公共核心永远不会重新引入 ST 业务耦合。

本阶段已完成：

- 删除旧 ST 兼容 re-export 文件：
  - `src/runtime/workflows/stDeliveryContract.ts`
  - `src/runtime/workflows/stInspectionWorkflow.ts`
  - `src/runtime/workflows/stToolContext.ts`
  - `src/runtime/workflows/stToolProvider.ts`
  - `src/runtime/workflows/stWorkspaceDeliveryWorkflow.ts`
  - `src/runtime/tools/validateStTool.ts`
  - `src/runtime/tools/dependencyTools.ts`
  - `src/runtime/pipeline/stWorkspaceDeliveryPlan.ts`
  - `src/runtime/stContentHash.ts`
- `scripts/test_entry.ts` 改为直接导出正式 ST 插件路径，不再经过公共层兼容路径。
- 公共 completion evidence 移除 ST 校验和 ST 写入哈希提取逻辑；新增
  `src/runtime/plugins/st/stCompletionEvidence.ts`，由 ST Workflow 通过通用
  `evidenceExtractors` 扩展点注入。
- Jev 任务 workflow 题目改为由当前注入的 Workflow Registry 动态生成；公共
  `agentDecision.ts` 不再内置 `st_delivery`、`st_inspection` 或
  `needs_validate_st_code`。
- 公共读文件工具和通用计划提示中的领域示例已改为领域中立文案。
- 新增 `scripts/runtime_boundary_test.mjs`，扫描公共 `src/runtime`（排除
  `src/runtime/plugins`）并阻止 ST 工具名、ST 分析器字段、旧 shim 路径和 `.st`
  业务判断重新进入公共核心。
- `npm run test:workflow` 和 `npm run test:batch` 已纳入边界测试。

阶段测试结果：

- `node scripts/runtime_boundary_test.mjs` 通过。
- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:workflow` 通过。
- `npm run test:batch` 通过。
- `npm run test:agent` 通过（含 mock gateway、ST 交付、审批、兜底和断点恢复）。
- `npm run test:st`、`npm run test:jev` 通过。

## 测试要求

每个阶段完成后至少运行：

```text
npx tsc --noEmit
npm run compile
```

最终运行：

```text
npm run test:batch
npm run test:agent
npm run test:st
npm run test:jev
node scripts/run_store_test.mjs
node scripts/run_coordinator_test.mjs
```

## 后续阶段：通用 Workflow 工具可见性策略

本阶段针对 `visibleToolNames` 的三个边界语义做了兼容性收敛：

- 新增 `businessToolNames`，明确它只控制 Provider 提供的业务工具。
- 新增 `resolveBusinessToolPolicy(context)`，允许 Workflow 根据当前用户请求、
  Workflow 状态和 `ToolCatalog` 动态返回本轮业务工具名单。
- 没有声明静态名单、动态 resolver 或显式默认策略时，业务工具默认
  `deny_all`，不再把“未声明”解释成“全部放行”。
- 如果确实需要开放全部业务工具，Workflow 必须显式声明
  `defaultBusinessToolAccess: "allow_all"`。
- `visibleToolNames` 保留为兼容别名；新插件应使用 `businessToolNames`。
- `report_plan_progress`、`deliver_artifact` 等运行时控制工具改称
  `runtimeControlTools` 通道，与业务工具分开组装，不受业务工具名单过滤。
- ST Inspection 已接入动态策略：依赖/引用请求只开放
  `st_dependency_map`，影响面请求只开放 `st_change_impact`，符号请求只开放
  `st_symbol_references`。

阶段验证：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:workflow` 通过，包含默认拒绝、显式 `allow_all`、描述器策略、
  动态 ST 工具选择和运行时控制工具隔离测试。

## 实施纪律

- 不修改 `st-analyze` 桥和 `src/analysis/*` 的实现。
- 不在公共层新增 ST 特判。
- 每完成一个阶段就更新本文件的进度和测试记录。
- 如果兼容性要求与“公共层无 ST 逻辑”冲突，兼容代码放在插件或宿主装配层。

## 实际执行记录

### 0. 基线记录

- 文档已建立。
- 当前仓库已有 Workflow Registry、Decision Service、ST Delivery 和 ST Inspection
  的初步抽象，但公共核心仍残留领域耦合；后续步骤会逐步迁移。
- 基线检查：`npx tsc --noEmit`、`npm run compile`、`npm run test:batch`、
  `npm run test:st`、`npm run test:jev` 均通过。
- `npm run test:agent` 的基线依赖本地 `127.0.0.1:8790` mock gateway；未启动该服务时
  会因 `ECONNREFUSED` 失败，属于测试环境依赖，不是本阶段编译失败。

### 1. 通用 Workflow 核心接口

- 在 `src/runtime/workflow/types.ts` 增加 `WorkflowState`、`WorkflowContract`、
  `WorkflowRuntimeContext`、`WorkflowToolPolicy`、`WorkflowCompletionAdapter`、
  `WorkflowRuntime` 和 `WorkflowDescription`。
- 保留 `DeliveryWorkflow` 作为兼容别名，现有 ST Workflow 不需要在本阶段改名。
- `WorkflowDescriptor` 增加通用 `matchesContract`、`createContract` 扩展点，
  同时保留旧交付接口，避免一次性破坏已有插件和宿主。

### 2. 注入式 Registry

- `src/runtime/workflow/registry.ts` 改为无领域导入的 `WorkflowRegistry` 实例。
- Registry 支持注册、批量注册、按 id/route 查询和按契约匹配。
- 旧的 `listWorkflows`、`getWorkflow`、`getWorkflowByRoute` 保留为兼容包装，
  默认 Registry 只作为迁移期桥接；运行时主链使用显式注入的 Registry。
- 新增 `src/app/workflowRegistry.ts` 作为宿主装配层，由宿主注册 ST Delivery 和
  ST Inspection；公共 Registry 文件不再直接导入 ST 插件。
- `WorkflowDecisionService`、`RunCoordinator`、Agent runtime、协议描述和 Team
  worker 均使用同一个注入 Registry。
- 新增 `scripts/workflow_registry_test.mjs`，验证通用 Registry 与宿主 ST 注册
  相互隔离。
- 阶段测试：`npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:batch`、`npm run test:st`、`npm run test:jev` 均通过。

### 3. 通用 Workflow 决策链

- `WorkflowDecisionService` 统一执行 Jev -> Registry 本地匹配 -> 模型分类 ->
  通用 fallback。
- 新增通用 `createWorkflowContract`，Workflow 选中后不再由 Coordinator 直接调用
  某个旧领域契约方法。
- `RunCoordinator` 改为依赖通用 `DeliveryContractClassifier` 类型，不再直接导入
  ST 文本推断函数。
- `classifyDeliveryContract` 只处理通用交付契约；ST 路由和 ST 契约创建由注册的
  ST Workflow 自己完成。
- `WorkflowDecision` 携带通用 Jev 信号，后续交付契约判定复用同一轮结果，避免同一
  请求重复调用 Jev 和重复计费。
- 保留暂停、恢复、普通 fallback、Team 路由和既有 ST Workflow 行为。
- 阶段测试：`npx tsc --noEmit`、`npm run compile`、`npm run test:batch`、
  `npm run test:st`、`npm run test:jev` 均通过。

### 4. 通用 Tool Provider Registry

- `ToolRegistry` 支持 Provider 注册、枚举、工具创建和工具风险查询；公共 Registry
  默认只装配通用 Core Provider，不直接导入领域 Provider。
- 新增 `src/runtime/tools/coreToolProvider.ts`，承载现有 PLC 查询、工作区读写和命令
  工具；新增 `src/runtime/workflows/stToolProvider.ts`，承载 ST 校验、导出、依赖图、
  影响面和符号引用工具。
- 新增 `src/app/toolRegistry.ts` 作为宿主装配层，将 Core 与 ST Provider 注册到同一
  Registry，并由 `ChatViewProvider` 注入 Coordinator；Agent 与 Team worker 均使用注入的
  Registry。
- Provider 统一声明工具风险，重复 Provider、重复工具名和冲突风险会被拒绝；通用
  Registry 测试确认只装载 Core 时不会出现 ST 工具，宿主 Registry 则包含 ST 工具。
- ST 分析器与 ST 校验状态迁入 ST Provider 上下文；`ToolBuildContext` 不再持有 ST
  分析器、缓存或校验状态。未改 `src/analysis/*` 或 `st-analyze` 桥。

### 5. 通用 `write_file` 与前置副作用钩子

- 文件写入工具只处理路径解析、通用前置钩子、审批保护、写入、内容哈希和通用回执，
  不再判断文件扩展名或领域校验状态。
- Tool Provider 可按具体工具，或按通用 `resourceKind: "file"` +
  `effect: "filesystem"` 注册多个异步 `beforeEffect` 钩子；钩子可阻止副作用并
  返回通用错误、诊断和元数据，也可在成功写入回执中附加领域证据。
- `write_file`、`edit_file` 和 `export_st_program` 都经过同一套文件级前置钩子；
  `edit_file` 在执行钩子前生成待写入完整内容和 diff，供任意领域 Provider 检查。
- ST Provider 将原有 ST 预写校验、内容哈希一致性检查和校验摘要迁入文件级前置钩子，
  交付校验和审批行为由既有 ST/Agent 回归测试覆盖。
- 阶段测试：`npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:batch`、`npm run test:agent`、`npm run test:st`、`npm run test:jev`
  均通过；Agent 测试使用本地 mock gateway。

### 5.1 文件级 `beforeEffect` 扩展（当前增量阶段）

- 公共 `BeforeEffectContext` 增加通用 `effect` 和 `resourceKind`，并提供
  `BeforeEffectSelector`、`runBeforeEffects` 和统一失败回执转换。
- `ToolRegistry` 从“按工具名 Map”改为通用 selector 注册和匹配；仍兼容旧的工具名
  selector，新增文件工具不需要在 Registry 里增加领域分支。
- `edit_file` 使用通用的 `prepareFileEdit` / `applyPreparedFileEdit` 两阶段接口：
  前置钩子可以看到最终完整内容、原内容和 diff，文件在钩子期间发生变化时会拒绝覆盖。
- `export_st_program` 也通过同一通用文件副作用入口，避免插件自有写入工具绕过前置检查。
- 新增 `scripts/before_effect_test.mjs`，用不包含 ST 逻辑的测试 Provider 验证三个文件
  写入工具的覆盖、回执传递和拒绝不落盘。
- 未修改 `src/analysis/*` 或 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:workflow` 通过。
- `npm run test:batch` 通过。
- `npm run test:agent` 通过（使用本地 `127.0.0.1:8790` mock gateway）。
- `npm run test:st`、`npm run test:jev` 通过。

### 5.2 通用 `ToolCatalog` 查询能力 fallback（当前增量阶段）

- `ToolFallbackMode` 扩展为 `general_chat`、`read_only`、`file_edit`、
  `needs_clarification` 和 `blocked_high_risk`，与公共 Workflow fallback 协议保持一致。
- `ToolCatalog` 新增通用 `toolsForQuery()` 和 `capabilityQueryForFallback()`；
  普通问答、需要澄清和高风险阻断模式统一查询 `risk=read/plan` 的能力。
- `WorkflowDecisionService` 对所有 fallback 模式优先使用注入的 `ToolCatalog`，
  不再只对 `read_only/file_edit` 调目录，其余模式也不会因为没有写死白名单而丢失
  可用的领域查询工具。
- 安全 fallback 只允许读或计划类能力，自动排除 `write`、`execute` 等副作用工具；
  新增领域工具只需声明通用能力风险，不需要修改公共决策逻辑。
- 新增回归覆盖：三种安全 fallback、目录查询、仅能力声明的领域工具、显式写入/命令
  工具隔离，以及模型 fallback 决策结果。
- 未修改 `src/analysis/*` 或 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:workflow`、`npm run test:batch` 通过。
- `npm run test:agent`、`npm run test:st`、`npm run test:jev` 通过。

### 6. 通用 Completion Gate

- 新增 `src/runtime/completionTypes.ts`，把 Completion Gate 的记录、问题、结果、
  Workflow Adapter 和上下文类型从领域模块中抽出，避免公共 Gate 与插件互相依赖。
- `completionGate.ts` 只依据通用工具结果、交付契约、Provider 声明的
  `DeliveryEvidence` 和可选 Workflow Completion Adapter 判定完成；移除了 ST 契约、
  ST 工具名、ST 扩展名和 ST 内容哈希判断。
- `ToolRegistry` 增加工具证据能力表；Core Provider 声明通用写入证据，ST Provider
  声明导出/写入证据。`Agent` 通过能力表选择修复工具，不再在公共 Agent 逻辑里写死
  领域工具名。
- ST 交付 Workflow 自己提供完成产物、失败恢复、验证证据和权威结果消息；ST 代码契约
  显式声明验证工具，不再由公共 `deliveryContract` 根据文件扩展名隐式补充。
- Completion Gate 统一处理恢复运行中重复的局部工具序号，保证历史失败与恢复后的成功
  结果仍按真实输入顺序判断，避免重复序号导致后续成功无法解决前序失败。
- 新增 Provider 证据、跨目标写入隔离、哈希不一致阻断、契约显式验证和恢复重复序号
  回归测试；Agent 端覆盖 ST 预写校验、摘要误判、草稿修复、审批折叠和恢复流程。
- 阶段测试：`npx tsc --noEmit`、`npm run test:batch`、`npm run test:agent`、
  `npm run test:st`、`npm run test:jev` 均通过；Agent 测试使用本地 mock gateway。
- 边界扫描确认 `completionGate.ts`、`completionTypes.ts`、`deliveryContract.ts`、
  `toolRegistry.ts` 和 `toolBuildContext.ts` 没有 ST 专用工具名、分析器或扩展名业务
  判断。未修改 `src/analysis/*` 或 `st-analyze` 桥。

### 5.3 动态公共层边界扫描（当前增量阶段）

- `scripts/runtime_boundary_test.mjs` 不再手写 ST 工具名黑名单；静态列表只保留架构
  耦合关键词，例如分析器类型、领域判断函数和 ST 扩展名模式。
- 边界测试会加载宿主测试装配生成的 `ToolRegistry`，从非 Core Provider 的
  `ToolCapability` 自动收集领域工具名，再检查这些工具名是否泄漏到公共
  `src/runtime` 核心。新增 ST、JSON、数据库或其他插件工具时不需要修改扫描脚本。
- `npm run test:boundary` 先重新生成测试 bundle，再执行扫描，避免使用过期的注册表
  快照；直接执行脚本时如果 bundle 不存在也会自动生成。
- 动态发现不到任何插件能力时测试直接失败，避免边界检查因装配异常而静默失效。
- 未修改 `src/analysis/*` 或 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:boundary`、`npm run test:workflow`、`npm run test:batch` 通过。
- `npm run test:agent`、`npm run test:st`、`npm run test:jev` 通过。

### 5.4 Jev 高置信度命令查询 fallback（当前增量阶段）

- 新增通用 `command_query` fallback；它不是普通 `read_only` 的别名，而是由工具能力
  显式声明是否参与。
- Jev 已高置信度判断 `run_command=yes` 且没有命中已注册 Workflow 时，决策链直接
  进入 `command_query`，不再被后续模型分类降级为 `read_only`。
- Core Provider 的 `run_command` 声明 `fallbackModes: ["command_query"]`；后续其他
  领域的受控命令工具可以用同一能力元数据接入，不需要修改决策服务。
- `command_query` 仍沿用 `run_command` 的用户审批、命令白名单、危险命令拦截、干运行
  和工具策略；普通问答、普通只读 fallback 和高风险阻断不会自动获得命令工具。
- 命令查询 fallback 跳过无意义的交付契约、Team 路由和通用规划，直接进入单 Agent
  工具执行。
- 未修改 `src/analysis/*`、`src/runtime/plugins/st/*` 或 `st-analyze` 桥。

阶段测试结果：

- `npx tsc --noEmit`、`npm run compile` 通过。
- `npm run test:workflow`、`npm run test:batch`、`npm run test:agent`、`npm run test:jev`
  通过。
- `npm run test:st` 通过；ST/analysis 相关改动来自已提交的独立阶段，本次未修改。
- 新增 ToolCatalog 与 Coordinator 回归，确认高置信度 `run_command` 能进入命令白名单，
  普通读请求和交付写入请求不会因此暴露命令工具。

### 5.4 只读领域工具的直接接入（当前增量阶段）

本阶段新增 `st_library_symbol`（IEC 61131-3 标准库符号查询），用来验证 5.2 的结论：
新增只读领域工具不需要新建 Workflow，也不需要改 `WorkflowDecisionService`。

- 桥新增 `action=library`：只读同目录 `data.json`（14 组 539 条标准符号），
  按符号名做大小写不敏感的精确匹配，不做模糊搜索 —— 查不到就返回 0 条，
  由模型换个名字再问，而不是给出"最接近的几条"把模型带偏。
- 分组名（如 `Standard function blocks`）只是 `data.json` 的组织方式，不返回给调用方；
  同名多用途的符号（如 ADD 的数值加法 / 时间加法 / TOD / DT）靠 `inputs` / `outputs`
  的类型签名区分，返回的是数组而非单条。
- 注释在符号表里是 gettext 表达式（`_("Addition")`、`_("Time-of-day addition")+" "+_("DEPRECATED")`），
  桥负责还原成可读文本；`inputs` 的第三项是边沿限定，`none` 不占位。
- 该动作在桥 `require` 引擎之前返回，不需要语言服务，实测耗时 7ms。
- 分析层新增 `StLibraryRequest` / `StLibraryResult` / `parseStLibraryResponse` 与
  `StAnalyzer.libraryLookup`；`SpawnStAnalyzer` 实现，`FallbackStAnalyzer` 与
  `ResilientStAnalyzer` 提供降级（降级时标注不可用，而不是假装"库里没有这个符号"）。
- 工具声明 `risk: "plan"`、`effect: "none"`，因此自动进入 `general_chat` /
  `needs_clarification` / `blocked_high_risk` 三个安全 fallback 工具集，
  决策服务与 `ToolCatalog` 的查询逻辑均未改动。
- 未新建 Workflow；`stWorkspaceDeliveryWorkflow` 的白名单仍只有 `validate_st_code` 与
  `write_file`（该白名单过窄是既有问题，与本次改动无关，另行处理）。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile` 通过。
- `npm run test:st` 通过（端口层 18 项 + 库查询 11 项）。
- `npm run test:batch`、`npm run test:workflow` 通过；`scripts/tool_catalog_test.mjs`
  中依赖 ST 工具清单的断言已同步更新。
- 新增 `scripts/st_library_test.mjs`：响应解析、降级可见、能力收录、桥端到端。

### 5.5 通用工具能力提示（当前增量阶段）

本阶段先补齐“工具意图筛选”的基础输入，不改变现有 Workflow 路由和工具白名单：

- `ToolCatalog` 新增通用 `renderToolCapabilityPrompt()`，把本轮实际可用工具的
  `description`、`intents`、`domain`、`risk`、`effect` 和审批要求渲染为模型可读提示。
- `agent.ts` 不再只告诉模型工具名称；模型现在能看到每个工具适合处理的用户意图，
  以及它是只读、计划、写入还是执行类能力。
- 提示只描述能力，不承担授权职责；真正的工具集合仍由 Workflow/fallback 白名单、
  审批、策略和运行时工具回执共同约束。
- 未登记在 `ToolCatalog` 中的运行时控制工具仍按名称保留，不要求插件为运行时控制
  逻辑补业务元数据。
- 本阶段未移除 `st_inspection`，也未修改 `src/analysis/*`、`src/runtime/plugins/st/*`
  或 `st-analyze` 桥；下一阶段再基于这个通用提示验证按意图收窄工具集合。

阶段测试结果：

- `npx tsc --noEmit`、`npm run compile` 通过。
- `npm run test:workflow`、`npm run test:batch`、`npm run test:agent`、
  `npm run test:st`、`npm run test:jev` 通过。
- `ToolCatalog` 回归覆盖了普通工具能力说明和未登记运行时控制工具的兼容展示。

### 5.6 通用工具意图筛选（当前增量阶段）

- `ToolCatalog` 新增通用文本意图匹配：只读取插件声明的 `name`、`description`、
  `intents`、`tags` 和 `domain`，不包含任何 ST 判断。
- fallback 先按原有风险/模式得到基础工具集，再对用户文本进行可解释的能力匹配；
  只有高置信度且候选数量有限时才收窄工具集。
- 没有命中、命中太弱、候选过多或意图相近时，保留原基础工具集，不因为一次本地
  匹配误删工具。
- 因此新增一个领域工具只需在 Provider 的 `ToolCapability` 中声明用途和意图，
  不需要修改 `WorkflowDecisionService` 或 `agent.ts` 的领域业务逻辑。
- 本阶段仍保留 `st_inspection` 兼容路由；下一阶段可以在关闭该路由后，用同一套
  `read_only + ToolCatalog` 验证 ST 依赖、影响面和符号查询。

阶段测试结果：

- `npx tsc --noEmit`、`npm run compile`、`npm run test:workflow` 通过。
- `ToolCatalog` 回归覆盖了普通文件编辑意图、未命中保守回退，以及 ST 工具作为
  外部 Provider 被通用筛选的行为。

### 5.7 ST 分析降级为通用只读 fallback（当前增量阶段）

- 宿主 `src/app/workflowRegistry.ts` 不再注册 `st_inspection`；默认可路由的 ST
  Workflow 只保留 ST Delivery。
- `stInspectionWorkflow.ts` 保留为兼容导出和独立测试用实现，但不再参与默认
  Registry 的自动决策，不再创建固定 ST 分析阶段、运行时契约或 `initialTool`。
- ST 依赖分析请求现在由通用决策链返回 `read_only`，再由 `ToolCatalog` 根据
  工具能力意图选择 `st_dependency_map`；影响分析和符号引用沿用同一机制，分别
  选择 `st_change_impact` 与 `st_symbol_references`。
- 未修改 `st-analyze`、`src/analysis/*` 和 ST 工具实现。

阶段测试结果：

- `scripts/workflow_registry_test.mjs` 已确认默认 Registry 不再暴露
  `st_inspection`。
- `scripts/jev_decision_test.mjs` 已确认 ST 依赖分析不再返回
  `workflow=st_inspection`，而是记录 `fallback read_only` 并只选择
  `st_dependency_map`。
- `scripts/tool_catalog_test.mjs` 同时覆盖依赖、影响面和符号引用三种只读意图
  到对应工具的通用映射。
- `npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:batch`、`npm run test:st`、`npm run test:jev` 和
  `npm run test:agent` 通过；Agent 专项使用临时本地 mock gateway 运行。

### 5.8 通用多意图 `ToolCatalog` 能力选择（当前增量阶段）

- `ToolCatalog` 新增通用意图片段拆分：支持中文标点、中文连接词和常见英文连接词，
  不依赖任何具体领域或工具名。
- 每个片段独立执行能力匹配，再对高置信度结果做去重合并；没有命中或结果过多时
  继续保留原 fallback 工具集，避免错误收窄。
- 同一请求可以同时开放多个互不冲突的工具能力，例如“读取文件并搜索文本”选择
  `read_file` 与 `search_files`，“分析依赖、影响范围并查找符号引用”选择三个
  对应分析工具；工具调用顺序和是否并行仍由模型与运行时并行能力决定。
- 多片段只有在上下文足够具体时才使用统一的 provider/domain 范围消歧；“查看文件”
  这类短而泛的片段保留原候选，不会被另一个片段强行改写成领域工具。
- 公共层只使用 `ToolCapability` 的描述、意图、标签、领域和风险元数据；新增领域
  工具仍只需注册能力，不需要修改 `agent.ts`、`WorkflowDecisionService` 或
  `src/analysis/*`。
- 修正单字连接词边界：`并`、`和`、`与`、`及` 只有在被中文分词识别为独立连接词时
  才会拆分，避免“合并文件”被切成“文件”并误选领域工具。
- 修正编辑 fallback 的保守收窄：基础 `file_edit` 工具集包含写能力时，如果当前
  意图只命中只读工具，则放弃收窄并保留完整编辑工具集，避免模型拿不到
  `write_file` / `edit_file`。
- 未修改 `st-analyze`、`src/analysis/*` 和现有 ST 工具实现。

阶段测试结果：

- `npx tsc --noEmit` 通过。
- `npm run compile`、`npm run test:workflow`、`npm run test:batch`、
  `npm run test:st` 和 `npm run test:jev` 通过。
- `npm run test:agent` 通过（使用仓库要求的本地 mock gateway）。
- `npm run test:generate` 通过。
- `scripts/tool_catalog_test.mjs` 新增多意图拆分、能力并集、去重、短片段消歧、
  词内连接词和编辑工具保留回归。
