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
- [ ] 8. 迁移 ST 功能为正式插件
- [ ] 9. 用非 ST Workflow 验证通用性
- [ ] 10. 清理兼容层并完成边界封锁

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

`write_file` 只负责路径边界、审批、写入、哈希和通用回执。领域验证通过通用
`beforeEffect` 钩子注入，不在公共工具中判断文件类型。

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

## 9. 非 ST Workflow 验证

增加只读的 `generic_file_inspection` 测试插件，验证不修改公共核心也能注册、
路由、执行、验收和恢复。

## 10. 清理与封锁

删除无调用方的旧兼容接口，保留必要的外部兼容导出；边界扫描进入测试命令，
确保公共核心永远不会重新引入 ST 业务耦合。

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

- `write_file` 只处理工作区路径解析、通用前置钩子、审批保护、写入、内容哈希和通用
  回执，不再判断文件扩展名或 ST 校验状态。
- Tool Provider 可为指定工具注册多个异步 `beforeEffect` 钩子；钩子可阻止副作用并
  返回通用错误、诊断和元数据，也可在成功写入回执中附加领域证据。
- ST Provider 将原有 ST 预写校验、内容哈希一致性检查和校验摘要迁入 `write_file`
  的前置钩子，交付校验和审批行为由既有 ST/Agent 回归测试覆盖。
- 阶段测试：`npx tsc --noEmit`、`npm run compile`、`npm run test:workflow`、
  `npm run test:batch`、`npm run test:agent`、`npm run test:st`、`npm run test:jev`
  均通过；Agent 测试使用本地 mock gateway。

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
