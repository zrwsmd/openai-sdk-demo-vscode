# plc-runtime.json v2 格式

状态：核心结构、IEC 源索引、库清单和任务组态同步已实现。设备部署元数据已经进入 v2 校验模型，完整的设备树、协议配置和 `var_mapped` 生成仍由目标适配器继续接入；旧版 v1 和早期 v2 文件会兼容读取并在下次保存时补齐。

## 1. 定位和边界

`plc-runtime.json` 是 PLC 工程的源配置。它描述任务调度、POU 索引、完整 IEC 编译源清单、运行库、设备、网络和 IO 映射，不保存 ST 正文，也不是 `plc_config.json` 或部署包。

顶层结构固定为：

```json
{
  "schemaVersion": 2,
  "tasks": [],
  "pous": [],
  "iecSources": [],
  "libraries": [],
  "devices": [],
  "networks": [],
  "ioMappings": []
}
```

各部分职责：

| 部分 | 职责 |
| --- | --- |
| `tasks` | Task 调度参数、目标设备和 PROGRAM 实例 |
| `pous` | POU 名称、类型和对应的 ST 源文件索引 |
| `iecSources` | 参与编译的全部 IEC 源文件，包括 POU、数据类型和全局变量 |
| `libraries` | 工程显式启用的 IEC/Runtime 库，用于生成 `iec-lib.json` |
| `devices` | 本地 PLC、扩展模块、远程设备和设备点位 |
| `networks` | Modbus、EtherCAT 等通信链路参数 |
| `ioMappings` | ST 变量与本地或远程点位之间的映射 |
| `runtimeOverrides` | 可选的高级运行时覆盖；普通工程不生成 |

POU 的变量声明和程序正文只存在于 `.st` 文件。JSON 不复制 `VAR`、`VAR RETAIN` 或实现代码。`pous` 是语义索引，`iecSources` 是编译输入清单；两者用途不同，不能用 `pous` 代替完整源码收集。

编译时由目标适配器读取 v2，并分别生成：

- IEC 任务和实例配置；
- `iec-lib.json` 和完整 IEC 源文件集合；
- 本地点位的 `VAR_CONFIG`；
- 远程点位的设备变量映射；
- devUni 的 `plc_config.json` 和编译工作目录；
- 其他运行时需要的设备树、网络配置或部署清单。

## 2. 完整示例

下面的示例覆盖 v2 的主要结构和常用可选字段。可选字段在没有值时直接省略，不写 `null`。

```json
{
  "schemaVersion": 2,
  "tasks": [
    {
      "name": "FastTask",
      "deviceId": "cpu_main",
      "type": "cyclic",
      "periodMs": 5,
      "priority": 0,
      "cpuCore": 0,
      "instances": [
        { "name": "instance_FastLoop", "pou": "FastLoop" }
      ]
    },
    {
      "name": "MainTask",
      "deviceId": "cpu_main",
      "type": "cyclic",
      "periodMs": 20,
      "priority": 1,
      "cpuCore": 1,
      "instances": [
        { "name": "instance_Main", "pou": "Main" }
      ]
    },
    {
      "name": "EventTask",
      "deviceId": "cpu_main",
      "type": "event",
      "periodMs": 100,
      "priority": 2,
      "cpuCore": 1,
      "instances": [
        { "name": "instance_AlarmHandler", "pou": "AlarmHandler" }
      ]
    }
  ],
  "pous": [
    { "name": "FastLoop", "pouType": "program", "source": "FastLoop.st" },
    { "name": "Main", "pouType": "program", "source": "Main.st" },
    { "name": "AlarmHandler", "pouType": "program", "source": "AlarmHandler.st" },
    { "name": "MotorControl", "pouType": "functionBlock", "source": "MotorControl.st" },
    { "name": "ScaleValue", "pouType": "function", "source": "ScaleValue.st" }
  ],
  "iecSources": [
    { "source": "FastLoop.st", "kind": "pou" },
    { "source": "Main.st", "kind": "pou" },
    { "source": "AlarmHandler.st", "kind": "pou" },
    { "source": "MotorControl.st", "kind": "pou" },
    { "source": "ScaleValue.st", "kind": "pou" },
    { "source": "types.st", "kind": "dataType" },
    { "source": "global_var.global.st", "kind": "globalVariables" }
  ],
  "libraries": ["SMC_Basic"],
  "devices": [
    {
      "id": "cpu_main",
      "name": "主控制器",
      "role": "local",
      "model": "SC5100",
      "profileId": "devuni:SC5100",
      "vendor": "SC",
      "firmware": "1.0.21",
      "runtime": { "coreCount": 2, "memoryMb": 512 },
      "modules": [
        {
          "id": "di_16",
          "slot": 1,
          "model": "SC-DI16",
          "kind": "digitalInput",
          "channels": 16
        },
        {
          "id": "ai_8",
          "slot": 2,
          "model": "SC-AI8",
          "kind": "analogInput",
          "channels": 8,
          "range": "0..10V",
          "resolutionBits": 12
        }
      ],
      "points": [
        {
          "id": "di_16.ch0",
          "address": {
            "kind": "direct",
            "address": "%IX0.0"
          },
          "direction": "input",
          "dataType": "BOOL",
          "module": "di_16",
          "channel": 0,
          "description": "启动按钮"
        },
        {
          "id": "ai_8.ch0",
          "address": {
            "kind": "direct",
            "address": "%IW64"
          },
          "direction": "input",
          "dataType": "INT",
          "module": "ai_8",
          "channel": 0,
          "range": "0..10V",
          "description": "出口压力"
        }
      ],
      "connections": []
    },
    {
      "id": "vfd_1",
      "name": "1 号变频器",
      "role": "remote",
      "model": "GD350",
      "profileId": "modbus:INVT-GD350",
      "taskName": "MainTask",
      "vendor": "INVT",
      "points": [
        {
          "id": "freq_set",
          "address": {
            "kind": "protocol",
            "networkId": "mb_rtu_1",
            "area": "holdingRegister",
            "offset": 8192,
            "wireType": "UINT16"
          },
          "direction": "output",
          "dataType": "UINT16",
          "description": "频率给定"
        }
      ],
      "connections": [
        { "networkId": "mb_rtu_1", "unitId": 1 }
      ]
    },
    {
      "id": "rio_1",
      "name": "远程 IO 站",
      "role": "remote",
      "model": "SC-RIO8",
      "profileId": "modbus:SC-RIO8",
      "taskName": "MainTask",
      "points": [
        {
          "id": "do0",
          "address": {
            "kind": "protocol",
            "networkId": "mb_tcp_1",
            "area": "coil",
            "offset": 0,
            "wireType": "BOOL"
          },
          "direction": "output",
          "dataType": "BOOL",
          "description": "现场指示灯"
        }
      ],
      "connections": [
        {
          "networkId": "mb_tcp_1",
          "endpoint": { "host": "192.168.1.10", "port": 502 },
          "unitId": 1
        }
      ]
    },
    {
      "id": "servo_1",
      "name": "1 号伺服",
      "role": "remote",
      "model": "SV660",
      "profileId": "ethercat:SV660-CiA402",
      "taskName": "FastTask",
      "points": [
        {
          "id": "control_word",
          "address": {
            "kind": "protocol",
            "networkId": "ecat_1",
            "index": "0x6040",
            "subIndex": 0,
            "wireType": "UINT16"
          },
          "direction": "output",
          "dataType": "UINT16",
          "description": "控制字"
        }
      ],
      "connections": [
        { "networkId": "ecat_1", "slaveIndex": 1 }
      ]
    }
  ],
  "networks": [
    {
      "id": "mb_tcp_1",
      "name": "车间以太网",
      "protocol": "modbusTcp",
      "mode": "master",
      "interface": {
        "name": "eth0",
        "ip": "192.168.1.5",
        "netmask": "255.255.255.0",
        "gateway": "192.168.1.1"
      },
      "timeoutMs": 1000,
      "retries": 3,
      "pollIntervalMs": 50
    },
    {
      "id": "mb_rtu_1",
      "name": "变频器总线",
      "protocol": "modbusRtu",
      "mode": "master",
      "serial": {
        "port": "COM3",
        "baudRate": 19200,
        "dataBits": 8,
        "parity": "none",
        "stopBits": 1
      },
      "timeoutMs": 500,
      "retries": 3,
      "pollIntervalMs": 100
    },
    {
      "id": "ecat_1",
      "name": "伺服总线",
      "protocol": "ethercat",
      "mode": "master",
      "interface": { "name": "eth1" },
      "cycleMs": 2,
      "distributedClock": true
    }
  ],
  "ioMappings": [
    {
      "variable": "StartButton",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "cpu_main/di_16.ch0",
      "invert": false
    },
    {
      "variable": "OutletPressure",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "cpu_main/ai_8.ch0",
      "scale": 0.01,
      "unit": "MPa"
    },
    {
      "variable": "FrequencySetpoint",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "vfd_1/freq_set",
      "scale": 100,
      "unit": "Hz"
    },
    {
      "variable": "RunLamp",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "rio_1/do0"
    },
    {
      "variable": "ServoControlWord",
      "task": "FastTask",
      "instance": "instance_FastLoop",
      "point": "servo_1/control_word"
    }
  ]
}
```

## 3. tasks

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | Task 名，IEC 标识符 |
| `deviceId` | 是 | Task 运行的本地控制器，引用 `devices[].id` |
| `type` | 是 | 通用 v2 支持 `cyclic` 或 `event`；当前 AccuPLC profile 只接受 `cyclic` |
| `periodMs` | 是 | 周期/间隔，毫秒，必须大于 0 |
| `priority` | 是 | 优先级，0 到 31 |
| `cpuCore` | 是 | CPU 核编号，非负整数 |
| `instances` | 是 | 该 Task 调度的 PROGRAM 实例，至少一个 |

Task 直接放在顶层，因为当前 devUni 1.0.21 会把每个 Task 自动展开成一个 Resource。v2 不保存没有独立编辑意义的 Resource 外壳。

v2 不提供 `trigger`。通用模型保留 `event` 作为其他目标的任务类型，但当前 AccuPLC 文档明确只支持周期任务，适配该目标时必须在编译前拒绝 `event`。不能把一个当前目标不会执行的 `trigger` 字段留在源配置中制造假能力。

v2 使用 `cyclic` 表达周期任务。devUni IDE 构建接口的中间输入使用 `cycle`，原始 `plc_config.json` 使用 `cyclic`，转换由适配器完成：

```text
v2 cyclic -> devUni build input cycle -> plc_config.task_type cyclic
v2 event  -> 当前 AccuPLC profile 拒绝
```

### 3.1 Instance

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | PROGRAM 实例名，在整个工程内唯一 |
| `pou` | 是 | 被实例化的 PROGRAM POU 名，引用 `pous[].name` |

实例不再保存 `source`。POU 到源码的定位由 `pous[].source` 管理，完整编译输入由 `iecSources[]` 管理。

实例不再保存 `retain`。保持属性必须写在 ST 的 `VAR RETAIN` 中。

通用 v2 允许一个 PROGRAM 有多个不同实例，实例名只需在工程内唯一。devUni IDE 1.0.21 默认按 `instance_<POU名>` 生成名称，但 AccuPLC Runtime 的实际发行工程使用过 `instance_1`、`instance_2` 等名称，`plc_config.json` 只要求实例名唯一。因此 `instance_<POU名>` 是生成默认值，不是 v2 或运行时硬约束。

## 4. runtimeOverrides

`runtimeOverrides` 是可选的高级覆盖项。普通工程和普通自然语言请求不得生成它；缺省值由 `tasks[].deviceId` 指向的设备型号配置和目标适配器提供。

```json
{
  "dataArea": {
    "input": 8192,
    "output": 8192,
    "memory": 16384
  },
  "retainPolicy": {
    "enabled": true,
    "intervalMs": 5000
  }
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `dataArea` | 否 | 覆盖运行时 I/Q/M 数据区大小 |
| `retainPolicy` | 否 | 覆盖保持变量的运行时持久化策略 |

`dataArea` 的 `input`、`output`、`memory` 均为非负整数，v2 统一以字节表示。覆盖值必须处于设备型号允许的范围内。

`retainPolicy.enabled` 控制是否周期性持久化，`intervalMs` 是毫秒周期且必须大于 0。需要保持哪些变量仍由 ST 源码中的 `VAR RETAIN` 决定；这里不声明变量。

运行时参数的取值顺序是：

1. 用户明确提供且通过设备能力校验的 `runtimeOverrides`；
2. 设备型号配置中的默认值；
3. 目标适配器明确声明的固定默认值。

如果三处都没有可用值，适配器必须报错，不能让模型猜测。

## 5. pous

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | POU 声明名，配置内唯一 |
| `pouType` | 是 | `program`、`functionBlock` 或 `function` |
| `source` | 是 | 工作区相对的 `.st` 源文件路径 |

`source` 不在 `instances` 重复保存。`pous[].source` 负责把 POU 声明定位到文件，`iecSources[]` 负责登记该文件参与编译；多个 POU 可以声明在同一个 `.st` 文件中，因此多个 POU 条目允许使用同一个 `source`，但对应的 `iecSources` 条目只有一个。

通用规则：

- `name` 必须是 IEC 标识符，不能包含点号、斜杠或扩展名；
- `source` 不能是绝对路径，不能包含 `.` 或 `..` 路径段；
- `source` 必须以 `.st` 结尾；
- `name` 必须与 `source` 文件内对应的 ST 声明名完全一致，包括大小写；
- 一个 `source` 可以包含多个 POU，每个 `PROGRAM`、`FUNCTION_BLOCK`、`FUNCTION` 都分别写入一个 `pous` 条目；
- 一个 POU 名只能由一个源文件声明，不能跨文件重名。

当前 devUni 1.0.21 只扫描编译目录根层的 `*.st`，不递归扫描子目录。devUni 适配器必须按不同的 `source` 去重，把每个源文件复制到临时编译目录根层；同一文件中声明的多个 POU 只复制一次。不同目录存在同名源文件时，适配器必须报冲突，不能静默覆盖。

```text
src/control/Main.st  -> <compileDir>/Main.st
src/library/Math.st  -> <compileDir>/Math.st
```

工作区源码可以放在子目录；“编译目录根层平铺”是 devUni 目标适配器的输出限制，不是 v2 源配置的目录限制。

### 5.1 iecSources

`iecSources` 是完整编译输入清单，解决 `pous[]` 无法表达独立数据类型和全局变量文件的问题。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `source` | 是 | 工作区相对的 `.st` 源文件路径 |
| `kind` | 是 | `pou`、`dataType` 或 `globalVariables` |

规则：

- 每个 `pous[].source` 必须引用一个 `kind: "pou"` 的 `iecSources` 条目；
- `iecSources[].source` 必须唯一，不能用不同 `kind` 重复登记同一文件；
- `dataType` 用于独立 `TYPE ... END_TYPE` 文件；
- `globalVariables` 用于 `VAR_GLOBAL` 文件，AccuPLC 新格式的标准文件名是 `global_var.global.st`；
- 历史工程中的 `gloval_var.global.st` 只在导入兼容层识别，新工程不得继续生成错误拼写；
- 编译适配器复制 `iecSources` 中的全部文件，不能只复制被 Task 实例直接引用的 PROGRAM；
- 新生成的 AccuPLC 工程遵循“一份独立 PROGRAM、FUNCTION_BLOCK、FUNCTION 或 datatype 对应一个文件”的工程约定；通用 v2 仍允许导入一个源文件声明多个 POU，目标适配器应按目标能力校验。

工作区可使用 `src/control/Main.st` 等子目录路径。AccuPLC 编译目录目前只扫描根层 `.st`，适配器负责平铺，并在平铺后文件名冲突时终止编译。

### 5.2 libraries

`libraries` 是工程显式启用的库名数组，适配器用它生成必需的 `iec-lib.json`。空数组表示工程没有显式启用外部库，但适配器仍须生成合法的 `iec-lib.json`。生成时以目标 profile 的完整库清单为基准：数组中出现的库写 `enable: true`，其余受支持库写 `enable: false`。

当前 AccuPLC profile 识别以下大小写敏感的名称：

```text
Native, Python, Etherlab, Motion, SMC_Basic
```

其中 `Python`、`Etherlab` 和 `Motion` 已在当前运行时文档中标记为弃用；`SMC_Basic` 是当前运动控制库。适配器必须按目标 profile 校验可用性。`Motion` 和 `Etherlab` 对 `Python` 的依赖由适配器解析并写入最终 `iec-lib.json`，不能要求模型重复推导依赖。

## 6. devices

### 6.1 Device

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 设备唯一标识，被 Resource、连接和点位引用 |
| `name` | 否 | 展示名，可以使用中文 |
| `role` | 是 | `local` 或 `remote` |
| `model` | 是 | 设备型号 |
| `profileId` | 否 | 设备目录/驱动 profile 标识，用于生成 `device_type`、参数和协议配置 |
| `taskName` | 设备树节点需要 | 设备 IO 读写所属 Task，引用 `tasks[].name` |
| `parentDeviceId` | 有父设备时 | 父设备的 `devices[].id`，用于生成设备树父子关系 |
| `globalVariable` | 设备需要 IEC 全局变量时 | 映射到运行时 `device_global_name` |
| `configRef` | 目标专用配置需要 | 工作区相对的协议配置文件或配置模板引用 |
| `vendor` | 否 | 厂商 |
| `firmware` | 否 | 固件版本 |
| `runtime` | 否 | 本地控制器能力 |
| `modules` | 否 | 扩展模块数组 |
| `points` | 是 | 设备点位数组，可以为空 |
| `connections` | 否 | 设备使用的网络连接 |

`device_index` 和 `parent_index` 是目标 `device_tree` 的运行时数字索引，不写入 v2。适配器按稳定顺序为设备分配 `device_index`，再由 `parentDeviceId` 计算 `parent_index`。没有父设备时生成 `-1`。

`profileId` 用于从设备目录取得驱动类型、参数 schema 和协议生成器；`configRef` 是完整通用建模尚未覆盖某种协议时的受控出口。两者都不得直接保存本机绝对路径。需要生成到 `device_tree` 的协议设备、虚轴和轴池必须提供 `taskName`；本地控制器仅作为 Task 目标且不生成设备树节点时可以省略。

`runtime` 字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `coreCount` | 否 | CPU 核数，正整数 |
| `memoryMb` | 否 | 可用内存，MB，正整数 |

### 6.2 Module

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 模块标识，设备内唯一 |
| `slot` | 是 | 槽位号，非负整数 |
| `model` | 是 | 模块型号 |
| `kind` | 是 | `digitalInput`、`digitalOutput`、`analogInput`、`analogOutput` 或 `mixed` |
| `channels` | 是 | 通道数，正整数 |
| `range` | 否 | 模拟量量程 |
| `resolutionBits` | 否 | 模拟量分辨率位数 |

### 6.3 Point

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 点位标识，设备内唯一 |
| `address` | 是 | 带 `kind` 判别字段的本地或远程地址对象 |
| `direction` | 是 | `input` 或 `output` |
| `dataType` | 是 | IEC 变量类型 |
| `module` | 否 | 所属模块 id |
| `channel` | 否 | 模块通道号 |
| `range` | 否 | 量程 |
| `description` | 否 | 展示说明 |

本地点位使用 `direct` 地址对象：

```json
{
  "kind": "direct",
  "address": "%IX0.0"
}
```

远程点位使用 `protocol` 地址对象：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `kind` | 是 | 固定为 `protocol` |
| `networkId` | 是 | 引用 `networks[].id` |
| `area` | Modbus 需要 | `coil`、`discreteInput`、`holdingRegister`、`inputRegister` |
| `offset` | Modbus 需要 | 寄存器或线圈偏移 |
| `index` | EtherCAT 对象需要 | 对象字典索引，如 `0x6040` |
| `subIndex` | EtherCAT 对象需要 | 对象字典子索引 |
| `wireType` | 是 | 协议线上使用的数据类型或编码 |

`points[].dataType` 是 PLC 逻辑点位类型，`address.wireType` 是协议传输类型。两者允许不同，例如寄存器以 `UINT16` 传输，再按缩放规则提供为 `REAL`。适配器必须验证转换是否受支持。

### 6.4 Connection

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `networkId` | 是 | 引用 `networks[].id` |
| `endpoint` | TCP 对端需要 | `{ host, port }`，描述这台设备自己的网络端点 |
| `unitId` | Modbus 从站需要 | Modbus 站号 |
| `slaveIndex` | EtherCAT 从站需要 | EtherCAT 从站序号 |

连接的对端角色由 Network 的本地 `mode` 反推，不重复保存。站号、从站序号和 TCP 端点只保存在 connection 中，不在每个 Point 的 address 中重复。Point 通过 `networkId` 找到所属设备上唯一的 connection，再取得这些设备级参数。

## 7. networks

公共字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 网络唯一标识 |
| `name` | 否 | 展示名 |
| `protocol` | 是 | `modbusTcp`、`modbusRtu`、`ethercat`、`opcUa` 或 `profinet` |
| `mode` | 是 | 本地控制器在该网络中的模式，`master` 或 `slave` |
| `timeoutMs` | 否 | 单次请求超时 |
| `retries` | 否 | 重试次数 |
| `pollIntervalMs` | 否 | 主站轮询间隔 |

协议字段：

| 字段 | 使用场景 | 说明 |
| --- | --- | --- |
| `interface` | TCP、EtherCAT、Profinet | `name` 必填，`ip`、`netmask`、`gateway` 可选 |
| `serial` | Modbus RTU | `port`、`baudRate`、`dataBits`、`parity`、`stopBits` |
| `listenPort` | TCP slave/server | 本地监听端口；master/client 的远程端点写在设备 connection 中 |
| `cycleMs` | EtherCAT | 总线周期，毫秒 |
| `distributedClock` | EtherCAT | 是否启用分布式时钟 |

Network 保存本地接口和共享通信参数。设备通过 `connections` 声明自己接入哪条网络，并保存该设备独有的 IP、端口、站号或从站序号。这样同一条 Modbus TCP 主站网络可以连接多台不同 IP 的设备。

## 8. ioMappings

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `variable` | 是 | 对应 PROGRAM 实例中的变量名 |
| `task` | 是 | Task 名 |
| `instance` | 是 | PROGRAM 实例名 |
| `point` | 是 | `<deviceId>/<pointId>` |
| `scale` | 否 | 原始值到工程值的缩放系数 |
| `unit` | 否 | 工程单位 |
| `invert` | 否 | BOOL 是否取反，默认 false |

`ioMappings` 同时保存本地点和远程点，但适配器必须按点位地址类型走不同通道。映射不重复保存 `dataType` 和 `direction`：变量类型从 ST 声明读取，点位类型和方向从 `devices[].points[]` 读取，审计器负责检查两边是否兼容。

### 8.1 本地点

本地点的 `devices[].points[].address.address` 是 `%IX`、`%QX`、`%IW` 等 IEC 直接地址。适配器将映射生成到 `VAR_CONFIG`：

```text
VAR_CONFIG
  instance_Main.StartButton AT %IX0.0 : BOOL;
  instance_Main.OutletPressure AT %IW64 : INT;
END_VAR
```

### 8.2 远程点

远程点的地址是协议对象。适配器不能把 Modbus 寄存器或 EtherCAT 对象硬塞进 `VAR_CONFIG`，而应生成目标运行时的设备变量映射、驱动通道或 `var_mapped`。

AccuPLC 的 `resources[].var_mapped` 是设备内存映射全集，不只是用户已经绑定的变量。适配器必须从设备 profile 展开所有可映射点位：存在 `ioMappings` 的点写入规范化后的 `<TASK>.<INSTANCE>.<VARIABLE>`，未映射点仍保留 `data_area_address` 并把 `iec_var` 写为空字符串。这样设备配置和 IO 内存布局不会因为暂时没有变量绑定而丢失。

## 9. 校验规则

### 9.1 命名和源码

- 所有 Task 名、实例名和 POU 名必须是 IEC 标识符；
- `pous[].name` 不得包含点号；
- POU 名必须与 ST 内声明名大小写完全一致；
- POU 名必须全局唯一；同一 `pous[].source` 可以承载多个 POU 声明；
- 每个 POU 源文件必须出现在 `iecSources`，独立 datatype 和全局变量文件也必须单独登记；
- `iecSources[].source` 必须存在、唯一且位于授权工程根目录内；
- `libraries` 不能重复，库名必须受目标 profile 支持；
- devUni 目标适配器必须把不同源文件平铺到临时编译目录根层，并拒绝文件名冲突；
- `instances[].source`、`instances[].retain` 和 `tasks[].trigger` 都是不支持的字段。

### 9.2 引用完整性

- `tasks[].deviceId` 必须引用 `role: "local"` 的设备；
- `devices[].taskName` 必须引用存在的 Task，且该 Task 的 `deviceId` 必须指向承载该设备的本地控制器；
- `devices[].parentDeviceId` 必须引用存在的设备，且设备父子关系不得成环；
- `instances[].pou` 必须引用 `pouType: "program"` 的 POU；
- `connections[].networkId` 和协议地址的 `networkId` 必须引用存在的网络；
- 协议地址的 `networkId` 必须在该 Point 所属设备的 connections 中恰好匹配一项；
- Modbus TCP master 网络上的每台远程设备必须在 connection 中提供 `endpoint`；
- TCP slave/server 网络必须提供本地 `listenPort`；
- `unitId`、`slaveIndex` 和 `endpoint` 必须从匹配的 connection 读取，Point 地址不得重复保存；
- `ioMappings[].task` 和 `instance` 必须能定位到唯一实例；
- `ioMappings[].point` 中的设备和点位必须存在；
- `ioMappings[].variable` 必须在实例对应的 PROGRAM 中声明；
- IO 映射的数据类型和方向必须与设备点位兼容。

### 9.3 唯一性和冲突

- 设备 id、网络 id、POU 名、Task 名和实例名必须全局唯一；
- 同一设备内模块 id、槽位号和点位 id 唯一；
- 同一设备内每个 `networkId` 最多对应一条 connection；
- 同一个输出点不能映射给多个变量；
- 输入点允许多个变量只读，但应给出重复映射提示；
- 本地 IEC 地址不能发生位宽重叠；
- 同一 Modbus RTU 网络内 `unitId` 唯一，同一 EtherCAT 网络内 `slaveIndex` 唯一；
- Modbus TCP 连接按 `endpoint.host`、`endpoint.port` 和 `unitId` 的组合唯一。

### 9.4 调度和运行时

- `periodMs` 必须大于 0；
- `priority` 必须为 0 到 31 的整数；
- `cpuCore` 必须小于 `task.deviceId` 所指设备的 `runtime.coreCount`；
- `runtimeOverrides.dataArea` 出现时，三个值必须为非负整数并符合设备型号限制；
- `runtimeOverrides.retainPolicy` 出现时，`intervalMs` 必须大于 0；
- 数据区必须能容纳全部本地 IEC 地址；
- PROGRAM 实例名必须在整个工程内唯一；`instance_<POU名>` 只是默认生成规则；
- 目标运行时不能执行的任务类型、协议或命名方式必须报错，不能只记录后继续编译。

## 10. TypeScript 类型

```ts
export type PlcTaskType = 'cyclic' | 'event';
export type PlcPouType = 'program' | 'functionBlock' | 'function';
export type PlcIecSourceKind = 'pou' | 'dataType' | 'globalVariables';
export type PlcLibraryName = 'Native' | 'Python' | 'Etherlab' | 'Motion' | 'SMC_Basic';
export type PlcDeviceRole = 'local' | 'remote';
export type PlcPointDirection = 'input' | 'output';

export interface PlcRuntimeConfigV2 {
  schemaVersion: 2;
  runtimeOverrides?: PlcRuntimeOverrides;
  tasks: PlcTask[];
  pous: PlcPou[];
  iecSources: PlcIecSource[];
  libraries: PlcLibraryName[];
  devices: PlcDevice[];
  networks: PlcNetwork[];
  ioMappings: PlcIoMapping[];
}

export interface PlcRuntimeOverrides {
  dataArea?: { input: number; output: number; memory: number };
  retainPolicy?: { enabled: boolean; intervalMs: number };
}

export interface PlcTask {
  name: string;
  deviceId: string;
  type: PlcTaskType;
  periodMs: number;
  priority: number;
  cpuCore: number;
  instances: PlcInstance[];
}

export interface PlcInstance { name: string; pou: string }
export interface PlcPou { name: string; pouType: PlcPouType; source: string }
export interface PlcIecSource { source: string; kind: PlcIecSourceKind }

export type PlcModuleKind =
  | 'digitalInput' | 'digitalOutput'
  | 'analogInput' | 'analogOutput' | 'mixed';

export interface PlcModule {
  id: string;
  slot: number;
  model: string;
  kind: PlcModuleKind;
  channels: number;
  range?: string;
  resolutionBits?: number;
}

export interface PlcDirectAddress {
  kind: 'direct';
  address: string;
}

export interface PlcProtocolAddress {
  kind: 'protocol';
  networkId: string;
  area?: 'coil' | 'discreteInput' | 'holdingRegister' | 'inputRegister';
  offset?: number;
  index?: string;
  subIndex?: number;
  wireType: string;
}

export interface PlcPoint {
  id: string;
  address: PlcDirectAddress | PlcProtocolAddress;
  direction: PlcPointDirection;
  dataType: string;
  module?: string;
  channel?: number;
  range?: string;
  description?: string;
}

export interface PlcDeviceConnection {
  networkId: string;
  endpoint?: { host: string; port: number };
  unitId?: number;
  slaveIndex?: number;
}

export interface PlcDevice {
  id: string;
  name?: string;
  role: PlcDeviceRole;
  model: string;
  profileId?: string;
  taskName?: string;
  parentDeviceId?: string;
  globalVariable?: string;
  configRef?: string;
  vendor?: string;
  firmware?: string;
  runtime?: { coreCount?: number; memoryMb?: number };
  modules?: PlcModule[];
  points: PlcPoint[];
  connections?: PlcDeviceConnection[];
}

export type PlcNetworkProtocol =
  | 'modbusTcp' | 'modbusRtu' | 'ethercat' | 'opcUa' | 'profinet';

export interface PlcNetwork {
  id: string;
  name?: string;
  protocol: PlcNetworkProtocol;
  mode: 'master' | 'slave';
  interface?: { name: string; ip?: string; netmask?: string; gateway?: string };
  serial?: {
    port: string;
    baudRate: number;
    dataBits: 5 | 6 | 7 | 8;
    parity: 'none' | 'even' | 'odd';
    stopBits: 1 | 2;
  };
  listenPort?: number;
  timeoutMs?: number;
  retries?: number;
  pollIntervalMs?: number;
  cycleMs?: number;
  distributedClock?: boolean;
}

export interface PlcIoMapping {
  variable: string;
  task: string;
  instance: string;
  point: string;
  scale?: number;
  unit?: string;
  invert?: boolean;
}
```

## 11. devUni 1.0.21 转换规则

v2 不是 devUni 的 `plc_config.json`。适配器按下表转换：

| v2 | devUni 输入/输出 |
| --- | --- |
| 无需源字段 | 固定生成 `configuration.configuration_name: "CONFIG_IEC"` |
| 设备型号默认值 | 默认生成顶层 `data_area` 和 `retain` |
| `runtimeOverrides.dataArea` | 通过设备能力校验后覆盖顶层 `data_area` |
| `runtimeOverrides.retainPolicy.enabled` | 覆盖 `retain.cyclic` |
| `runtimeOverrides.retainPolicy.intervalMs` | 覆盖 `retain.interval`，单位毫秒 |
| 每个顶层 `tasks[]` 条目 | 一个原始 `configuration.resources[]` 条目 |
| `task.deviceId` | 选择本地控制器、设备型号配置和运行时默认值，不写入 `resource_on` |
| `task.name` | `task_name` |
| `task.type: cyclic` | 构建输入 `cycle`，原始输出 `task_type: cyclic` |
| `task.type: event` | 当前 AccuPLC profile 在调用 `start.exe` 前拒绝 |
| `task.periodMs` | 构建输入为 `periodMs * 1000` 微秒，原始 `plc_config.interval` 为 `periodMs * 1000000` 纳秒 |
| `task.cpuCore` | `cpu_core` |
| `task.priority` | `priority` |
| `instance.pou` | `instances[].type` |
| `instance.name` | `instances[].name`；未指定时 IDE 可默认生成 `instance_<pou>` |
| `iecSources` | 将全部源文件复制并平铺到编译目录根层 |
| `libraries` | 展开目标库清单和依赖，生成 `iec-lib.json` |
| 本地 `ioMappings` | 生成 IEC `VAR_CONFIG` |
| 远程 `ioMappings` + 设备 profile 点位 | 生成完整 `var_mapped`；未绑定点的 `iec_var` 为空 |
| `devices[].taskName` | `device_tree[].task` |
| `devices[].parentDeviceId` | 通过适配器分配的索引生成 `parent_index` |
| `devices[].globalVariable` | `device_global_name` |
| `devices[].profileId/configRef`、`networks` | 生成 `device_tree`、`device_info` 和协议运行时配置 |
| `connections[].endpoint` | 写入 `device_tree[].config_file` 指向的独立 TCP 协议配置文件 |
| `connections[].unitId/slaveIndex` | 写入对应设备的 Modbus 或 EtherCAT 配置 |

devUni 当前固定生成：

```text
configuration_name = CONFIG_IEC
resource_name = resource_<Task名>
resource_on   = plc
```

适配器还负责把 `iecSources` 中的全部源文件复制到 `.depworkspace`，生成 `iec-lib.json` 和协议配置，再调用：

```text
start.exe -i <compileDir>
```

工具链路径、GCC 参数和编译缓存属于本机工具环境，不进入 v2。

## 12. 版本和兼容策略

- 新写入的 v2 文件必须包含 `tasks`、`pous`、`iecSources`、`libraries`、`devices`、`networks`、`ioMappings`；Task 引用的本地设备必须存在，没有库、网络或映射时写空数组；
- 过渡期读取缺少 `iecSources` 或 `libraries` 的早期 v2 文件时，仓库层从 `pous[].source` 派生 POU 源清单并使用空库列表；下次保存必须写出新字段。无法自动发现的 datatype 和全局变量文件必须通过工作区扫描补齐，不能静默遗漏；
- `runtimeOverrides` 可选，迁移和普通 Agent 生成流程不得为了凑字段而添加；
- v1 读取后可迁移为 v2：将所有 Resource 下的 Task 展平到顶层，并把原 Resource 的目标设备迁移为 `task.deviceId`；
- v1 迁移必须显式补齐 `pous`、`iecSources`、`libraries`、`devices`、`networks` 和 `ioMappings`；
- v1 的每个 `programs[].source` 迁移到对应 POU 条目的 `pous[].source`，并登记为 `kind: "pou"` 的 IEC 源；
- v1 的 `programs[].retain` 不迁移为实例字段，应检查 ST 源码中是否存在对应的 `VAR RETAIN`；
- 大于 2 的版本必须明确报“配置版本过新”，不能按 v2 猜测解析；
- 解析器应拒绝未知字段，避免拼写错误被静默忽略；
- 部署产物、编译生成文件和目标私有缓存不得反写进 v2。

## 13. 建议落地顺序

1. 实现顶层 Task 结构、可选运行时覆盖、严格校验器和 v1 到 v2 的显式迁移。
2. 实现全部 IEC 源码扫描、POU 索引和库配置同步。
3. 实现 Task、实例、POU 引用和调度参数检查。
4. 实现本地 IO 地址冲突、类型、方向和数据区范围检查。
5. 实现设备、网络、协议地址和远程 IO 映射检查。
6. 实现 devUni 适配器，生成 `plc_config.json`、`VAR_CONFIG` 和设备变量映射。
7. 把审计、源码复制、配置生成和编译作为一个工程级事务执行。

## 14. 运行时事实依据

本格式与 AccuPLC 目标有关的规则来自同事提供的运行时资料和发行示例：

- 《IEC项目结构》：编译目录必须包含全部 `.st`、`iec-lib.json`、`plc_config.json` 和协议配置；
- 《plc_config文件格式》：Task 到 Resource、实例、`var_mapped`、`device_tree`、retain 和 data area 的真实字段；
- 《iec-lib文件详解》：库名、启用格式和依赖关系；
- 发行示例：验证任意唯一实例名、完整 ST 文件集合、设备任务绑定和实际输出结构。

devUni IDE 1.0.21 的 `resource_<Task>`、`instance_<POU>` 和顶层文件扫描是 IDE 适配器当前行为。文档中已把这些约定与 AccuPLC Runtime 的硬性输入要求分开，后续实现不得把 IDE 默认命名重新收紧成通用 v2 校验规则。
