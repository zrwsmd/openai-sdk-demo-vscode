# PLC 任务组态与 matiec 适配计划

状态：第一版方案，按阶段实现

## 1. 目标与边界

用户通过 Agent 生成 PLC 程序时，程序代码和运行时任务组态分开保存：

- `.st` 文件只包含 `PROGRAM`、`FUNCTION_BLOCK` 等 IEC 61131-3 程序内容。
- 不在用户源文件中生成 `CONFIGURATION`、`RESOURCE`、`TASK` 或 `PROGRAM ... WITH ...` 配置块。
- 工作区根目录使用一个可见、可编辑的 `plc-runtime.json` 保存配置名称、PLC 资源、任务周期、优先级和程序到任务的绑定。
- 后续编译阶段读取 JSON，再生成 matiec 或运行时需要的临时配置；临时产物不反写用户的 ST 源文件。

这份 JSON 是项目源配置，不直接等同于插件部署阶段的完整 `plc_config.json`。工具链路径、设备树、数据区和部署产物属于后续适配层。

## 2. 依据

### 2.1 matiec 的 IEC 语义

matiec 支持以下层级：

```text
CONFIGURATION
  RESOURCE ... ON ...
    TASK ... (INTERVAL := ..., PRIORITY := ...)
    PROGRAM <instance> [WITH <task>] : <program type>
```

因此配置模型不能只保存“文件 -> 周期”的扁平关系，至少要保留：

- configuration 名称；
- resource 及其目标 PLC；
- task 名称、类型、周期和调度参数；
- program instance、program type 和源文件。

### 2.2 现有 IDE 插件

参考扩展：

`C:\Users\Administrator\.vscode\extensions\ytak.devuni-ide-vscode-1.0.21`

它已经有一套接近目标的模型：

- `.devUni` 任务模型保存 `priority`、`core`、`task.type`、`task.value`、`unitType`；
- 任务通过 `pouList` 绑定 POU；
- 生成的 `plc_config.json` 使用 `configuration.resources[]`；
- 每个资源记录 `task_name`、`task_type`、`interval`、`cpu_core`、`priority` 和 `instances[]`；
- 编译工作区会把任务和 POU 生成到 matiec 使用的实例配置中。

我们复用这些语义，但把用户源配置整理成更清晰的嵌套格式，并明确时间单位。

## 3. 第一版源配置格式

文件位置：

```text
<workspace>/plc-runtime.json
```

示例：

```json
{
  "schemaVersion": 1,
  "configuration": {
    "name": "CONFIG_IEC",
    "resources": [
      {
        "name": "resource_MainTask",
        "target": "PLC",
        "tasks": [
          {
            "name": "MainTask",
            "type": "cyclic",
            "periodMs": 1000,
            "priority": 1,
            "cpuCore": 1,
            "programs": [
              {
                "instanceName": "instance_PLC_PRG",
                "typeName": "PLC_PRG",
                "source": "PLC_PRG.st"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 3.1 字段语义

| 源配置字段 | 含义 | 后续适配目标 |
| --- | --- | --- |
| `configuration.name` | IEC 配置名称 | `CONFIGURATION` / `configuration_name` |
| `resources[].name` | 资源名称 | `RESOURCE` / `resource_name` |
| `resources[].target` | 资源运行目标 | `RESOURCE ... ON ...` / `resource_on` |
| `tasks[].name` | 任务名称 | `TASK` / `task_name` |
| `tasks[].type` | `cyclic` 或 `event` | 周期任务或事件任务 |
| `tasks[].periodMs` | 周期，统一使用毫秒 | `INTERVAL := T#...ms` |
| `tasks[].priority` | 调度优先级 | matiec `PRIORITY`，运行时调度优先级 |
| `tasks[].cpuCore` | 运行时 CPU 核心 | 运行时扩展字段，不写进 ST |
| `programs[].instanceName` | 程序实例名 | matiec `PROGRAM` 实例 / `pouInstance.name` |
| `programs[].typeName` | 程序类型名 | ST 中的 `PROGRAM` 名称 / `typeName` |
| `programs[].source` | 源文件相对路径 | 编译输入文件 |

`periodMs` 是源配置的稳定单位。现有插件内部的 `interval` 在不同阶段存在微秒、纳秒和运行时显示值之间的转换，不能直接暴露给 Agent 或用户；转换必须集中在后续适配器中。

### 3.2 事件任务

第一版保留事件任务模型，但周期任务优先实现：

```json
{
  "name": "AlarmTask",
  "type": "event",
  "priority": 2,
  "cpuCore": 1,
  "trigger": {
    "kind": "variable",
    "ref": "Global.AlarmTrigger",
    "edge": "rising"
  },
  "programs": []
}
```

事件任务不要求 `periodMs`，必须有触发条件。具体触发语义由运行时适配器定义，不能在没有运行时支持前假装已经被 matiec 完整表达。

## 4. 与 ST 生成的关系

生成请求的处理规则：

1. 生成或修改 `.st` 时，只处理程序代码。
2. 如果用户明确提供了任务、周期和 PLC 归属，则同步写入或更新 `plc-runtime.json`。
3. 如果已有唯一匹配任务，则复用，不重复打断用户。
4. 如果缺少必要信息、存在多个候选或绑定关系不明确，则进入“任务组态确认”弹窗。
5. 用户确认后再同时提交 ST 文件和 JSON 配置。
6. JSON 无法通过校验时，不应声称 ST 和组态都已完成。

弹窗需要支持：

- 选择已有 PLC 资源；
- 选择已有任务；
- 选择常用周期或填写自定义周期；
- 设置优先级和 CPU 核心；
- 选择要绑定的程序；
- 自定义答案；
- 用户取消后保留原文件，不写入半成品配置。

## 5. 分阶段实现顺序

### 阶段 1：源配置模型

目标：

- 定义 TypeScript 类型；
- 定义严格校验；
- 读取和原子写入 `plc-runtime.json`；
- 时间统一为 `periodMs`；
- 不改现有 Agent、ST 生成和编译流程。

验收：

- 合法配置可读写；
- 缺字段、重复名称、非法 IEC 标识符、非法路径和错误周期会明确报错；
- 写入中断不会留下半写文件；
- 缺少配置文件时返回“未配置”，而不是伪造默认任务。

### 阶段 2：工作区配置仓库

目标：

- 以工作区根目录定位 `plc-runtime.json`；
- 配置不存在时能区分“首次配置”和“配置损坏”；
- 监听或刷新配置；
- 为 Agent 和后续弹窗提供查询接口；
- 兼容多根工作区时明确使用的根目录。

### 阶段 3：程序与任务绑定

目标：

- 从 ST 文件识别 PROGRAM 类型；
- 检查程序是否已有唯一任务绑定；
- 支持新增、修改和删除绑定；
- 更新 JSON 时保持其它任务和资源不变；
- 不向 ST 写入 `CONFIGURATION` 等内容。

### 阶段 4：任务组态弹窗

目标：

- 增加结构化的 clarification 请求；
- 支持选项和自定义文本；
- 用户取消时不产生文件副作用；
- 把确认结果转成阶段 3 的配置更新；
- 对高风险或影响设备运行的字段继续保留审批。

### 阶段 5：matiec / 运行时适配

目标：

- 将源 JSON 映射到临时 IEC 实例配置；
- 将 `periodMs` 明确转换为 matiec 的 `TIME#...ms`；
- 将任务和程序实例生成到编译输入；
- 将 `cpuCore`、设备树、变量映射等运行时字段交给运行时适配器；
- 不污染用户源 ST。

### 阶段 6：迁移与回归

目标：

- 为已有只包含 ST 的工作区提供首次配置流程；
- 校验配置与实际 `.st` 文件的一致性；
- 覆盖多任务、多程序、事件任务和无配置场景；
- 回归审批、恢复、上下文和现有 ST 交付链路。

## 6. 暂不做的事情

- 不把 matiec 编译器直接嵌进 Agent 核心；
- 不把完整设备树和 GCC 工具链字段塞进用户源 JSON；
- 不在 ST 文件中自动追加 `CONFIGURATION`；
- 不在缺少用户确认时替用户猜测关键任务周期；
- 不把事件任务伪装成普通周期任务。

## 7. 实现记录

### 第一阶段：源配置模型

实现文件：

- `src/plc/plcRuntimeConfig.ts`
- `scripts/plc_runtime_config_test.mjs`

已完成：

- 定义 `configuration -> resources -> tasks -> programs` 源模型；
- 统一使用 `periodMs`；
- 校验 IEC 标识符、任务周期、优先级、程序绑定和工作区相对路径；
- 原子写入并串行化同一配置文件的并发访问。

### 第二阶段：工作区配置仓库

实现文件：

- `src/plc/plcRuntimeConfigRepository.ts`
- `scripts/plc_runtime_repository_test.mjs`

已完成：

- 固定从工作区根目录读取 `plc-runtime.json`；
- 明确区分 `missing`、`ready`、`invalid`；
- 配置损坏时不静默生成默认配置，也不允许通过便捷接口覆盖；
- 为后续 Agent 查询和任务组态弹窗提供 `refresh`、`getSnapshot`、`save`、`assertReady` 接口。

### 第三阶段：程序与任务绑定识别

实现文件：

- `src/plc/plcProgramBinding.ts`
- `scripts/plc_program_binding_test.mjs`

已完成：

- 从 ST 代码区识别 `PROGRAM` 声明；
- 忽略注释和字符串中的伪声明；
- 支持 `PROGRAM RETAIN` 和 `PROGRAM NON_RETAIN` 声明；
- 按 `typeName + source` 精确解析程序绑定；
- 显式区分唯一绑定、未绑定、源文件不一致和重复绑定；
- 提供按任务查询程序绑定的接口。

这一阶段只做识别和查询，不会自动修改 ST 或 JSON。

验证：

```text
npx tsc --noEmit
npm run compile
npm run test:plc-config
```

下一阶段：

- 为未绑定或有歧义的程序生成任务组态弹窗所需的选项；
- 增加用户确认后的 JSON 增量更新；
- 保证取消弹窗不会写入配置。

### 第四阶段：通用澄清弹窗基础设施

实现文件：

- `src/runtime/clarification.ts`
- `src/runtime/tools/clarificationTool.ts`
- `src/protocol/events.ts`
- `src/runtime/runCoordinator.ts`
- `src/app/chatView.ts`
- `media/main.js`
- `media/main.css`
- `scripts/run_coordinator_test.mjs`
- `scripts/tool_catalog_test.mjs`

已完成：

- 新增 `clarification.requested` / `clarification.resolved` 协议事件；
- 新增 `request_clarification` 核心工具，风险为 `plan`、无副作用；
- 运行时可在执行中等待用户回复，回复后继续本轮执行；
- 前端以“消息记录卡 + 居中弹窗”展示澄清问题；
- 弹窗支持候选选项、自定义答案、确认和取消；
- 澄清通道独立于审批通道，不复用 `approval` 状态；
- 用户取消只返回 `cancelled: true`，不会直接写入文件或配置。

验证：

```text
npx tsc --noEmit
npm run test:protocol
npm run test:workflow
node scripts/run_coordinator_test.mjs
```

已知边界：

- 这一阶段的第一版只提供通用澄清能力，还没有把 PLC 任务组态结果自动写入 `plc-runtime.json`；
- 弹窗适合补齐周期、任务名、PLC 资源等缺失字段，高风险副作用仍走审批；
- 扩展进程重启时，正在等待澄清的运行会按现有运行恢复策略处理，后续可再做持久化澄清断点。

### 第四阶段补充：ST 写入后的任务组态接线

实现文件：

- `src/plc/plcRuntimeConfigSync.ts`
- `src/runtime/tools/toolBuildContext.ts`
- `src/runtime/tools/writeFileTool.ts`
- `src/runtime/tools/editFileTool.ts`
- `src/runtime/plugins/st/stToolProvider.ts`
- `src/runtime/plugins/st/tools/validateStTool.ts`
- `scripts/plc_runtime_sync_test.mjs`

已完成：

- `write_file`、`edit_file`、`export_st_program` 支持后置 effect；
- ST 文件写入前识别单个 `PROGRAM`；
- 如果 `plc-runtime.json` 缺失，弹窗要求选择周期并创建第一份任务组态；
- 如果已有任务但当前程序未绑定，弹窗允许绑定到已有任务或创建新周期任务；
- ST 文件实际写入成功后，再提交 `plc-runtime.json`；
- 已绑定的程序不会重复打断用户；
- 用户取消弹窗会阻止本次 ST 写入，也不会生成半成品 JSON；
- 仍然不会向 ST 文件追加 `CONFIGURATION`、`RESOURCE` 或 `TASK`。

验证：

```text
npx tsc --noEmit
npm run compile
npm run test:plc-config
npm run test:workflow
npm run test:protocol
npm run test:batch
```

已知边界：

- 第一版只自动处理每个 `.st` 文件里一个 `PROGRAM` 的场景；
- `export_st_program` 只有在导出目标属于工作区相对路径时才会参与任务组态，普通会话导出目录不强行写工作区配置；
- 如果已有 `plc-runtime.json` 语法损坏，会阻止本次 ST 写入并要求先修复配置；
- 真实 matiec CLI 调用和部署产物生成仍属于后续适配阶段。

### 第五阶段：matiec / 运行时适配

实现文件：

- `src/plc/plcMatiecAdapter.ts`
- `scripts/plc_matiec_adapter_test.mjs`
- `scripts/test_entry.ts`
- `package.json`

已完成：

- 从 `plc-runtime.json` 生成临时 IEC `CONFIGURATION` 文本；
- 将 `periodMs` 转换为 matiec 可读的 `T#...ms`；
- 将任务和程序实例生成为虚拟编译输入 `__generated__/plc_configuration.st`；
- 保留用户原始 ST 源文件为普通 source 输入，不向源文件反写 `CONFIGURATION`；
- 生成运行时部署摘要，保留 `cpuCore`、任务优先级、周期、触发条件和程序绑定；
- 第一版显式拒绝把 event 任务渲染成 matiec cyclic `TASK`。

验证：

```text
npx tsc --noEmit
npm run test:plc-config
```

已知边界：

- 这一阶段仍不直接调用 matiec CLI；
- event 任务只会出现在运行时部署摘要里，不会被生成到 IEC `TASK(INTERVAL := ...)`；
- 资源 `target` 在适配层要求是 IEC 标识符，否则会阻止生成 matiec 配置。

### 第六阶段：迁移与回归

实现文件：

- `src/plc/plcRuntimeConfigAudit.ts`
- `src/runtime/plugins/st/tools/plcRuntimeTools.ts`
- `src/runtime/plugins/st/stToolProvider.ts`
- `scripts/plc_runtime_audit_test.mjs`
- `scripts/plc_runtime_tool_test.mjs`
- `scripts/test_entry.ts`
- `package.json`

已完成：

- 增加只读审计入口，扫描工作区 `.st` 文件并读取 `plc-runtime.json`；
- 明确报告 `plc-runtime.json` 缺失、损坏、程序未绑定、绑定重复、绑定源文件缺失、源文件声明不匹配等问题；
- 对 event 任务输出运行时适配提示，避免误认为已经能生成 matiec cyclic `TASK`；
- 增加首次配置草稿生成入口，但必须显式传入 `periodMs`，不替用户猜默认周期；
- 注册只读工具 `audit_plc_runtime_config`，Agent 可在检查任务组态、`plc-runtime.json` 或编译前配置时调用；
- 覆盖缺配置、合法配置、配置损坏、源文件缺失、声明不匹配、事件任务、首次配置草稿和工具执行测试。

验证：

```text
npx tsc --noEmit
npm run test:plc-config
```

已知边界：

- 审计器目前只产出本地报告，还没有 UI 命令或自动修复流程；
- `audit_plc_runtime_config` 只读报告问题，不自动修复或写入配置；
- 首次配置草稿不会自动写盘，后续仍应通过弹窗确认后再保存；
- 审计扫描默认跳过 `.git`、`.vscode`、`.vscode-test`、`dist`、`node_modules`、`out` 和 `coverage`。

后续每完成一个阶段，在本节补充实现文件、验证命令和已知限制。
