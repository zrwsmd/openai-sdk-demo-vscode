# Agent 首响应延迟优化计划

本文记录后续“快”的优化方向。目标是降低用户体感等待时间和首个可见反馈延迟，但不能通过砍掉
Jev、Workflow 判定、Delivery contract、context compaction、工具筛选、恢复判断等基础设施来换速度。

## 核心边界

- 不删除 Jev。
- 不删除 Workflow 判定。
- 不删除 Delivery contract。
- 不删除 context compaction。
- 不删除工具筛选和 ToolCatalog 能力选择。
- 不删除暂停/恢复判断和 RunState/safe restart 机制。
- 不绕过审批、命令白名单、危险工具拦截和 effect journal。
- 优化的是调度、缓存、短路命中和 UI 可见进度，不是降低安全性或交付可靠性。

## 当前延迟来源

一次新请求在主 agent 执行前，可能依次经过：

1. 历史上下文读取和 context compaction。
2. Workflow 判定。
3. Delivery contract 判定。
4. Team 路由。
5. 单任务 Plan 规划。
6. 工具集合构建和工具筛选。
7. 主 agent 执行。

这些步骤是有价值的：它们负责安全、恢复、交付契约、工具边界和复杂任务规划。问题不是它们不该存在，
而是需要减少不必要等待，并让用户更早看到明确进度。

## 优化原则

- 优先让“有把握的本地判断”提前结束等待，但保留模型判定作为不确定时的后备。
- 优先复用已有 Jev 结果、Workflow 决策、上下文预算和工具筛选结果，避免同一轮重复判断。
- 优先把可并行的只读准备工作并行化，但不能并行有副作用的工具执行。
- 优先提前发 UI 阶段事件，让用户知道正在做什么。
- 只有在状态机设计清楚后，才考虑把路由/规划真正后台化。

## 阶段顺序

### 1. 增强前置阶段可见性

目标：即使仍然阻塞，也让用户马上看到 agent 在做什么。

建议：

- 为 context compaction、Workflow 判定、Delivery contract、Team 路由、Plan 规划发出统一进度事件。
- UI 显示轻量阶段状态，例如“正在整理上下文”“正在选择工具”“正在确认交付要求”。
- 保持现有暂停/恢复语义不变。

验证：

- 手动验证普通问答、ST 交付、暂停后继续、可恢复错误。
- `npm run compile`
- `npm run test:generate; node scripts/run_coordinator_test.mjs`

实现状态：

- 已完成：RunCoordinator 为上下文、Workflow、Delivery、Team 路由和 Plan 发出宿主侧
  `preflight` 阶段事件。
- 已完成：WebView 在当前回答前显示单行阶段状态，首个 Thinking、工具调用或终态事件到达后自动收起。
- 已完成：前置状态不进入可回放协议历史，避免历史会话被等待提示污染。
- 已验证：`npm run compile`、`node --check media/main.js`、`node scripts/run_coordinator_test.mjs`。

### 2. 复用 Jev 和 Workflow 决策结果

目标：减少重复判定，不减少判定本身。

建议：

- 梳理同一轮中 Jev 结果如何传给 WorkflowDecisionService、Delivery contract 和工具筛选。
- 若 Jev 高置信度已经给出 workflow / tools / delivery 信号，后续阶段优先消费这些信号。
- 不确定时仍走现有模型判定。
- 日志中明确写出“复用 Jev 信号”还是“进入模型判定”。

不能做：

- 不能因为想快就跳过高风险/交付任务的二次确认。
- 不能把 Jev 的低置信度 uncertain 当成确定结论。

验证：

- `npm run test:jev`
- `npm run test:workflow`
- `npm run test:batch`

### 3. 前置本地短路

目标：对非常明确的普通问答、纯只读查询、纯命令查询，减少额外模型前置调用。

建议：

- 使用已有本地规则和 ToolCatalog metadata 做低风险短路。
- 只在 confidence 足够高且风险低时短路。
- 短路结果仍要落日志，方便回放和排错。
- ST 交付、写文件、命令执行、设备相关请求不能只靠轻量规则跳过安全链路。

验证：

- 普通问答不应误触 ST Delivery。
- ST Delivery 不应被误降级为 general chat。
- 命令查询仍保留审批/白名单/危险命令拦截。
- `npm run test:workflow`
- `npm run test:agent`
- `npm run test:batch`

### 4. Context compaction 调度优化

目标：保留压缩机制，但减少不必要的首轮阻塞。

建议：

- 先用预算估算判断是否真的需要压缩。
- 明确区分“必须压缩才能进模型”和“可延后压缩”的情况。
- 对不会超预算的短历史，直接跳过压缩模型调用。
- 对接近预算但未超的历史，可以在本轮结束后做后台维护压缩。

不能做：

- 不能关闭 token 预算检查。
- 不能在可能超上下文窗口时强行发送完整历史。
- 不能丢掉用户约束和关键工具摘要。

验证：

- `node scripts/context_manager_test.mjs`
- `node scripts/context_session_test.mjs`
- `npm run test:batch`

### 5. 工具筛选结果缓存与复用

目标：减少同一轮内反复构建和渲染工具能力提示的成本。

建议：

- 对同一轮请求缓存 ToolCatalog 能力选择结果。
- Workflow 判定、Fallback 工具选择、Agent 工具提示复用同一份工具可见性结果。
- 缓存 key 必须包含 workflow、fallback mode、用户文本片段和可用工具版本。

验证：

- 复合意图仍能开放多个工具。
- file_edit 模式不会错误挤掉写工具。
- ST 辅助工具仍只作为辅助工具，不强制调用。
- `scripts/tool_catalog_test.mjs`
- `npm run test:workflow`

### 6. 规划轻量化

目标：减少 Plan 规划对首响应的阻塞，同时保留复杂任务规划能力。

建议：

- 普通短任务默认不规划。
- 只有明确复杂任务、用户要求计划、或 Team 路由需要时才规划。
- 规划失败继续走单 agent，但保留日志。
- 规划结果仍进入 UI 和 run store。

不能做：

- 不能让 ST 交付因为跳过 plan 而跳过 Workflow/Delivery contract。

验证：

- `npm run test:generate; node scripts/run_coordinator_test.mjs`
- `npm run test:batch`

### 7. 后台路由/规划实验

目标：探索“主 agent 先启动，路由/规划后台进行”的模式。

这是高风险阶段，只能在前面阶段稳定后做。

必须先设计：

- 后台路由结果如何和已经开始的 single agent 合并。
- 如果后台判断需要 Team，是否中止 single agent、等待本轮结束，还是只影响下一轮。
- 如果后台生成 plan，如何避免和当前工具执行冲突。
- 暂停/恢复时 `resumeStage` 如何表达后台阶段。
- run store 如何保证状态一致。

建议先做实验开关：

- 默认关闭。
- 仅对无副作用、无交付契约、低风险请求开启。
- ST Delivery、写文件、命令执行、设备相关请求默认不启用后台路由/规划。

验证：

- 全量回归：
  - `npm run compile`
  - `npm run test:generate`
  - `npm run test:batch`
  - `npm run test:workflow`
  - `npm run test:st`
  - `npm run test:jev`

## 完成标准

- 首个可见状态更早出现。
- 普通低风险请求的首字延迟下降。
- ST 交付、命令执行、文件写入和恢复链路的可靠性不下降。
- 日志能解释每一轮为什么走快路径或完整路径。
- 没有用“删除基础设施”换速度。
