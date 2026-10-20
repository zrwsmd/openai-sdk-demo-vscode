# PLC 任务组态与 matiec 适配

状态：v2 已接入 Agent 的 ST 交付流程。

完整字段和校验规则见 `docs/plc-runtime-v2-format.md`。本文只描述当前代码如何生成、保存和消费任务组态。

## 1. 目标与边界

- `.st` 文件保存 IEC 61131-3 POU 声明和正文。
- 工作区根目录的 `plc-runtime.json` 保存 Task、POU 索引、设备、网络和 IO 映射。
- 源文件不追加 `CONFIGURATION`、`RESOURCE`、`TASK` 或 `PROGRAM ... WITH ...`。
- 编译适配器根据 v2 临时生成 matiec 和 devUni 所需的目标格式。
- `plc-runtime.json` 不是 `plc_config.json`，也不直接交给 `start.exe`。

## 2. 当前源配置

```json
{
  "schemaVersion": 2,
  "tasks": [
    {
      "name": "MainControlTask",
      "deviceId": "plc",
      "type": "cyclic",
      "periodMs": 20,
      "priority": 1,
      "cpuCore": 0,
      "instances": [
        { "name": "instance_PLC_PRG", "pou": "PLC_PRG" }
      ]
    }
  ],
  "pous": [
    { "name": "PLC_PRG", "pouType": "program", "source": "PLC_PRG.st" }
  ],
  "devices": [
    {
      "id": "plc",
      "role": "local",
      "model": "PLC",
      "points": [],
      "connections": []
    }
  ],
  "networks": [],
  "ioMappings": []
}
```

普通 ST 请求不会生成 `runtimeOverrides`。设备数据区和保持策略由设备型号配置或目标适配器提供，只有用户明确要求覆盖时才写入该字段。

## 3. ST 交付时的任务组态流程

当前接线入口是 `src/plc/plcRuntimeConfigSync.ts`：

1. `write_file`、`edit_file` 或 `export_st_program` 准备写入工作区内的 `.st` 文件。
2. 复用公共 ST 上下文收集器读取工作区内已有的 `.st` 文件，并用本次待写内容覆盖同路径的磁盘旧内容。
3. 从完整文件池识别所有 `PROGRAM`、`FUNCTION_BLOCK` 和 `FUNCTION` 声明，重建 `pous[]` 索引。
4. 读取工作区根目录的 `plc-runtime.json`。
5. 本次文件没有 `PROGRAM` 时只同步 POU 索引，不显示任务弹窗。
6. 本次 `PROGRAM` 已有唯一绑定时不弹窗，也不重复创建 Task。
7. 未绑定时生成任务建议并显示“任务组态确认”弹窗。
8. 用户可以绑定已有 Task、选择建议周期，或填写自定义周期和调度参数。
9. 用户取消时阻止本次交付，不写 ST，也不写 JSON。
10. ST 文件成功落盘后，后置 effect 原子保存 v2 配置。

首次生成 v2 时会写入：

- 一个顶层 Task；
- 工作区内全部 POU 的索引，包括独立文件中的 PROGRAM、FUNCTION_BLOCK 和 FUNCTION；
- 一个最小本地 PLC 设备；
- 空的 `networks` 和 `ioMappings` 数组。

后续同一工作区新增 PROGRAM 时，弹窗可把新实例绑定到已有 Task，或者创建新的顶层 Task。只有 PROGRAM 会进入 `tasks[].instances[]`；FUNCTION_BLOCK 和 FUNCTION 只进入 `pous[]`，即使它们由 PROGRAM 跨文件引用也不会被误建成任务实例。POU 的源码路径只写在 `pous[].source`，实例只保存 `name` 和 `pou`。

`pous[]` 是工程 POU 清单，不是依赖闭包，因此不能只收录当前 PROGRAM 能沿依赖边到达的文件。`st_dependency_map`、`st_symbol_references` 和 `st_change_impact` 继续负责语义依赖、符号引用和反向影响分析；POU 索引同步复用相同的公共 ST 上下文收集器，但不会把语言服务可用性变成写文件的硬前置条件。

## 4. 旧版迁移

`src/plc/plcRuntimeConfig.ts` 仍可读取 schemaVersion 1：

```text
configuration.resources[].tasks[].programs[]
```

读取时会在内存中转换为：

```text
tasks[].instances[] + pous[] + devices[]
```

读取本身不改用户文件。下次通过仓库保存配置时，磁盘文件统一写成 schemaVersion 2，且不再包含 `configuration`、`resources`、`programs`、实例级 `source/retain` 或 Task `trigger`。

旧版 event Task 如果没有正数 `periodMs`，无法无损迁移，校验器会明确报错并要求补齐。

## 5. matiec 和 devUni 适配

`src/plc/plcMatiecAdapter.ts` 不要求 v2 保存 Resource。适配时固定生成：

```text
CONFIGURATION CONFIG_IEC
  RESOURCE resource_<Task名> ON plc
    TASK <Task名>(INTERVAL := T#<periodMs>ms, PRIORITY := <priority>);
    PROGRAM <实例名> WITH <Task名> : <POU名>;
  END_RESOURCE
END_CONFIGURATION
```

每个顶层 Task 生成一个 Resource。`cpuCore` 等运行时字段进入部署摘要，再由 devUni 适配器转换成 `plc_config.json` 的 `cpu_core` 等字段。

当前 devUni 1.0.21 的额外限制：

- 实例名必须是 `instance_<POU名>`；
- 适配器必须把不同 POU 源文件平铺到临时编译目录根层；
- 同一个源文件可声明多个 POU，复制编译输入时必须按 `source` 去重；
- 平铺后文件名冲突必须报错；
- matiec 适配目前只生成 cyclic Task，event Task 会明确拒绝。

这些是目标适配限制，不是通用 v2 的永久结构限制。

## 6. 审计

`audit_plc_runtime_config` 和 `src/plc/plcRuntimeConfigAudit.ts` 检查：

- 配置缺失或损坏；
- PROGRAM 未绑定、重复绑定或源文件不一致；
- POU 源文件缺失；
- POU 索引名与 ST 声明不一致；
- event Task 尚不能进入当前 matiec 适配。

核心 v2 校验器还负责 Task、POU、设备、网络、点位和 IO 映射的结构与引用完整性。ST 变量到点位的类型、方向和地址冲突检查仍需在设备适配和工程级审计阶段继续实现。

## 7. 实现文件

- `src/plc/plcRuntimeConfig.ts`：v2 类型、严格校验、v1 迁移和原子写入。
- `src/plc/plcRuntimeConfigRepository.ts`：工作区配置仓库。
- `src/plc/plcRuntimeConfigSync.ts`：ST 交付后的任务组态弹窗和增量更新。
- `src/plc/plcProgramBinding.ts`：PROGRAM、POU 和 Task 实例绑定解析。
- `src/plc/plcMatiecAdapter.ts`：临时 IEC 配置和部署摘要。
- `src/plc/plcRuntimeConfigAudit.ts`：工作区一致性审计。
- `src/runtime/plugins/st/stToolProvider.ts`：ST 写入后的配置提交。
- `src/runtime/plugins/st/tools/plcRuntimeTools.ts`：只读审计工具。

验证命令：

```text
npx tsc --noEmit
npm run compile
npm run test:plc-config
```

## 8. 后续工作

- 接入 devUni 完整 `plc_config.json`、设备树和协议配置生成器。
- 增加本地 IO 地址冲突、变量类型和方向检查。
- 增加设备型号、网络与协议参数的 profile 校验。
- 为 v2 提供独立的查看、编辑和修复界面。
- 为多个 POU 和组态提供同一工程事务，保证整体成功或整体回滚。
