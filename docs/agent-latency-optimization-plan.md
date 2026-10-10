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

实现状态：

- 已完成：Workflow 决策把 Jev 的交付、编排、读写/命令工具需求和审批倾向作为
  可复用信号向后传递。
- 已完成：Delivery contract 优先消费同一轮 Workflow 信号；只有明确
  `delivery=not_required` 时才跳过交付契约模型判定，`required/unknown` 继续确认。
- 已完成：Team 路由消费同一份编排信号，不再为已完成 Workflow 判定重复请求 Jev；
  信号不确定时仍进入原有路由模型。
- 已完成：信号写入 `DurableRunRecord`，安全重启或暂停后继续时保持一致。
- 已完成：高置信度 `orchestration=single` 只抑制不必要的 Team/Plan 前置等待，
  不改变 Workflow、Delivery、审批和工具授权边界。
- 已验证：新增 Coordinator、Jev 路由和信号恢复回归测试。

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

状态：已完成第一版。

实现：

- `ToolCatalog` 缓存 fallback 能力选择和工具能力提示渲染结果。
- 缓存 key 包含目录版本、调用 scope、fallback mode、规范化后的用户文本和工具名序列。
- 注册新的能力后递增 `selectionVersion`，清空旧选择和提示缓存，避免沿用过期元数据。
- `WorkflowDecision.allowedTools` 与 `run.toolAllowlist` 仍是本轮已选工具集合；缓存不成为授权来源。
- Agent 最终仍通过 Workflow policy、allowlist、审批和运行时 guard 过滤工具。
- 缓存有界为 128 项，避免长时间运行的插件进程被不同用户文本无限增长。

验证：

- 复合意图仍能开放多个工具。
- file_edit 模式不会错误挤掉写工具。
- ST 辅助工具仍只作为辅助工具，不强制调用。
- `scripts/tool_catalog_test.mjs`
- `npm run test:workflow`

### 5.1 Prompt Cache 观测与网关能力记忆

状态：已完成第一阶段。

实现：

- 保持 Prompt Cache 默认关闭，并继续只对主 Agent 的 OpenAI 兼容请求注入缓存选项。
- `buildChatCompletionsModel` 不再从通用 Agent 配置隐式恢复缓存设置；调用方必须显式传入，辅助角色传 `undefined` 时保持关闭。
- 按“网关地址 + API 路径格式 + 模型”记忆网关是否支持 `prompt_cache_options`，有界保留最多 64 项。
- 同一网关能力在新的 fetch/client 实例之间复用，避免重复发送一次“带缓存参数失败，再无缓存重试”的探测请求。
- 响应日志补充 `input`、`cached`、`write`、`hit` 和 `state`，区分 `hit`、`write`、`miss`、`unknown`。
- 缓存统计兼容顶层和嵌套 usage 字段，覆盖 OpenAI/Anthropic 及兼容网关常见的
  `cached_tokens`、`cache_read_input_tokens`、`cache_creation_input_tokens`、
  `prompt_cache_hit_tokens`、`prompt_cache_miss_tokens` 等别名；命中率优先按总输入量
  计算，避免把“未缓存输入”和“缓存命中输入”混作分母。
- 网关没有返回缓存明细时记录 `cache=unreported,state=unknown`，不把“未上报”误判为未命中。
- 启用缓存选项的请求额外记录短哈希前缀指纹：
  `prefix=<hash> full=<hash> toolset=<hash> tools=<n> messages=<n> prefixMessages=<n>`。
  `prefix` 只包含稳定请求前缀和末条消息之前的消息，`full` 包含完整消息；日志不记录
  原始提示词内容，可用于观察不同请求是否复用了相同前缀。
- 不改变 Jev、Workflow、Delivery、工具筛选、审批和恢复链路。

验证：

- `npx tsc --noEmit`
- `npm run compile`
- `npm run test:generate; node scripts/agent_kernel_test.mjs` 的 Prompt Cache 专项
  `[0a]`、`[0aa]`、`[0ab]`、`[0ac]` 已通过，完整 Agent 内核回归通过。
- `npm run test:batch` 全部通过。

### 5.2 工具顺序稳定化

状态：已完成第一版。

实现：

- 以 `ToolCatalog` 中的能力注册顺序作为已知工具的唯一排序依据，不按当前用户文本、
  fallback 命中顺序或模型返回顺序改变工具数组。
- `ToolRegistry.createTools()` 和 Agent 最终工具集合统一经过同一排序；运行时控制工具
  以及没有能力元数据的旧工具按名称做确定性兜底排序。
- Workflow 模型返回的显式 `allowedTools` 也先去重、规范化并按能力目录排序，避免同一
  allowlist 因模型输出顺序不同而产生不同请求前缀。
- ToolCatalog 的文本匹配在分数相同的时候按注册顺序稳定；多意图筛选、fallback 工具
  集合和能力提示渲染都复用稳定顺序。
- 这一步只改变工具数组和提示文本的排列，不改变工具筛选、allowlist、审批、运行时
  guard 或 workflow 安全边界。

验证：

- `scripts/tool_catalog_test.mjs` 覆盖工具名去重排序、能力提示排列稳定、注册工具数组
  排列和显式 allowlist 排列。
- `npm run test:batch`
- `npm run test:generate; node scripts/agent_kernel_test.mjs`

### 6. 规划轻量化

目标：减少 Plan 规划对首响应的阻塞，同时保留复杂任务规划能力。

建议：

- 普通短任务默认不规划。
- 只有明确复杂任务、用户要求计划、或 Team 路由需要时才规划。
- 规划失败继续走单 agent，但保留日志。
- 规划结果仍进入 UI 和 run store。

不能做：

- 不能让 ST 交付因为跳过 plan 而跳过 Workflow/Delivery contract。

实现状态：

- 已完成：通用 Planner 只在独立规划阶段需要时进入；低风险、无交付、无写入/
  命令副作用且已有明确 Workflow/Jev 信号的请求跳过 Planner。
- 已完成：用户明确要求执行计划、任务计划、步骤或规划时，即使执行编排仍为
  `single`，也保留 Planner。
- 已完成：Team 编排、ST/其他运行时托管 Workflow、Delivery contract、审批、
  工具授权和命令策略不受本阶段短路影响。
- 已验证：新增只读请求跳过 Planner、明确计划请求保留 Planner 的 Coordinator 回归。

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
