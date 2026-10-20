# plc-runtime.json v2 格式（任务组态 + 设备组态 + 网络组态）

状态：格式提案，尚未实现

## 1. 边界

v1 只描述 IEC 61131-3 的 CONFIGURATION 段：配置、资源、任务、程序实例。它回答"哪个程序在哪个周期跑"。

v2 在此基础上补齐四件事：

- POU 清单：工程里有哪些程序单元，只存名字、类型和源文件，不存正文。
- 设备组态：有哪些设备、什么型号、插了哪些模块、有哪些可用点位。
- 网络组态：有哪些链路、什么协议、链路参数是什么、设备挂在哪条链路上。
- IO 映射：程序里的变量占用哪个物理点位。

POU 的正文和变量声明不进这个文件。它们在 `.st` 源码里，JSON 只存索引，编译和导出时按 `source` 去读文件。

这个文件仍然是项目源配置，不是部署产物。编译时由适配器翻译成 matiec 的 CONFIGURATION 段和运行时的设备树，部署产物不反写这里。

## 2. 版本策略

`schemaVersion` 从 1 升到 2。

- v2 解析器读 v1：`pous`、`devices`、`networks`、`ioMappings` 补空数组，其余按原样解释，行为与现在完全一致。
- v1 解析器读 v2：必须明确报"配置版本过新，请升级扩展"，不能当成 v1 硬读，也不能因为出现未知字段就笼统报"不支持的字段"。
- 新增字段一律可选。必填字段的增删只能靠大版本号，不做静默兼容。
- 四个新块各自独立校验。设备配错不影响读任务组态，网络配错不影响读设备。

## 3. 完整示例

一个 SC5100 主控，带一块 16 路数字量输入、一块 8 路模拟量输入；通过 Modbus RTU 挂一台变频器；通过 Modbus TCP 挂一个远程 IO 站；另有一条 EtherCAT 链路接伺服。

```json
{
  "schemaVersion": 2,
  "configuration": {
    "name": "CONFIG_IEC",
    "resources": [
      {
        "name": "resource_MainTask",
        "deviceId": "cpu_main",
        "tasks": [
          {
            "name": "FastControlTask",
            "type": "cyclic",
            "periodMs": 5,
            "priority": 0,
            "cpuCore": 0,
            "instances": [
              {
                "name": "instance_FastLoop",
                "pou": "FastLoop",
                "source": "src/FastLoop.st"
              }
            ]
          },
          {
            "name": "MainControlTask",
            "type": "cyclic",
            "periodMs": 20,
            "priority": 1,
            "cpuCore": 1,
            "instances": [
              {
                "name": "instance_StartStopControl",
                "pou": "StartStopControl",
                "source": "src/StartStopControl.st"
              },
              {
                "name": "instance_PumpControl",
                "pou": "PumpControl",
                "source": "src/PumpControl.st",
                "retain": true
              }
            ]
          },
          {
            "name": "AlarmTask",
            "type": "event",
            "priority": 2,
            "cpuCore": 1,
            "trigger": {
              "kind": "variable",
              "ref": "instance_StartStopControl.AlarmTrigger",
              "edge": "rising"
            },
            "instances": [
              {
                "name": "instance_AlarmHandler",
                "pou": "AlarmHandler",
                "source": "src/AlarmHandler.st"
              }
            ]
          }
        ]
      }
    ]
  },
  "pous": [
    { "name": "FastLoop", "pouType": "program", "source": "src/FastLoop.st" },
    { "name": "StartStopControl", "pouType": "program", "source": "src/StartStopControl.st" },
    { "name": "PumpControl", "pouType": "program", "source": "src/PumpControl.st" },
    { "name": "AlarmHandler", "pouType": "program", "source": "src/AlarmHandler.st" },
    { "name": "PidBlock", "pouType": "functionBlock", "source": "src/PidBlock.st" },
    { "name": "ScaleAnalog", "pouType": "function", "source": "src/ScaleAnalog.st" }
  ],
  "devices": [
    {
      "id": "cpu_main",
      "name": "主控 PLC",
      "role": "local",
      "model": "SC5100",
      "vendor": "SC",
      "firmware": "1.0.21",
      "runtime": {
        "coreCount": 2,
        "memoryMb": 512
      },
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
          "address": "%IX0.0",
          "direction": "input",
          "dataType": "BOOL",
          "module": "di_16",
          "channel": 0,
          "description": "启动按钮"
        },
        {
          "id": "di_16.ch1",
          "address": "%IX0.1",
          "direction": "input",
          "dataType": "BOOL",
          "module": "di_16",
          "channel": 1,
          "description": "停止按钮"
        },
        {
          "id": "ai_8.ch0",
          "address": "%IW64",
          "direction": "input",
          "dataType": "INT",
          "module": "ai_8",
          "channel": 0,
          "range": "0..10V",
          "description": "出口压力变送器"
        }
      ],
      "connections": []
    },
    {
      "id": "vfd_1",
      "name": "1 号变频器",
      "role": "remote",
      "model": "GD350",
      "vendor": "INVT",
      "points": [
        {
          "id": "vfd_1.freq_set",
          "address": {
            "network": "mb_rtu_1",
            "unitId": 1,
            "area": "holdingRegister",
            "offset": 8192,
            "dataType": "UINT16"
          },
          "direction": "output",
          "dataType": "UINT16",
          "description": "频率给定"
        },
        {
          "id": "vfd_1.run_status",
          "address": {
            "network": "mb_rtu_1",
            "unitId": 1,
            "area": "inputRegister",
            "offset": 12288,
            "dataType": "UINT16"
          },
          "direction": "input",
          "dataType": "UINT16",
          "description": "运行状态字"
        }
      ],
      "connections": [
        {
          "networkId": "mb_rtu_1",
          "role": "slave",
          "unitId": 1
        }
      ]
    },
    {
      "id": "rio_1",
      "name": "远程 IO 站",
      "role": "remote",
      "model": "SC-RIO8",
      "points": [
        {
          "id": "rio_1.do0",
          "address": {
            "network": "mb_tcp_1",
            "unitId": 1,
            "area": "coil",
            "offset": 0,
            "dataType": "BOOL"
          },
          "direction": "output",
          "dataType": "BOOL",
          "description": "现场指示灯"
        }
      ],
      "connections": [
        {
          "networkId": "mb_tcp_1",
          "role": "slave",
          "unitId": 1
        }
      ]
    },
    {
      "id": "servo_1",
      "name": "1 号伺服",
      "role": "remote",
      "model": "SV660",
      "points": [
        {
          "id": "servo_1.enable",
          "address": {
            "network": "ecat_1",
            "slaveIndex": 1,
            "index": "0x6040",
            "subIndex": 0,
            "dataType": "UINT16"
          },
          "direction": "output",
          "dataType": "UINT16",
          "description": "控制字"
        }
      ],
      "connections": [
        {
          "networkId": "ecat_1",
          "role": "slave",
          "slaveIndex": 1
        }
      ]
    }
  ],
  "networks": [
    {
      "id": "mb_tcp_1",
      "name": "车间以太网",
      "protocol": "modbusTcp",
      "role": "master",
      "interface": {
        "name": "eth0",
        "ip": "192.168.1.5",
        "netmask": "255.255.255.0",
        "gateway": "192.168.1.1"
      },
      "host": "192.168.1.10",
      "port": 502,
      "timeoutMs": 1000,
      "retries": 3,
      "pollIntervalMs": 50
    },
    {
      "id": "mb_rtu_1",
      "name": "变频器总线",
      "protocol": "modbusRtu",
      "role": "master",
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
      "role": "master",
      "interface": {
        "name": "eth1"
      },
      "cycleMs": 2,
      "distributedClock": true
    }
  ],
  "ioMappings": [
    {
      "variable": "StartButton",
      "task": "MainControlTask",
      "instance": "instance_StartStopControl",
      "point": "cpu_main/di_16.ch0",
      "dataType": "BOOL",
      "direction": "input"
    },
    {
      "variable": "StopButton",
      "task": "MainControlTask",
      "instance": "instance_StartStopControl",
      "point": "cpu_main/di_16.ch1",
      "dataType": "BOOL",
      "direction": "input"
    },
    {
      "variable": "OutletPressure",
      "task": "MainControlTask",
      "instance": "instance_PumpControl",
      "point": "cpu_main/ai_8.ch0",
      "dataType": "INT",
      "direction": "input",
      "scale": 0.01,
      "unit": "MPa"
    },
    {
      "variable": "FreqSetpoint",
      "task": "MainControlTask",
      "instance": "instance_PumpControl",
      "point": "vfd_1/vfd_1.freq_set",
      "dataType": "UINT16",
      "direction": "output",
      "scale": 100,
      "unit": "Hz"
    },
    {
      "variable": "RunLamp",
      "task": "MainControlTask",
      "instance": "instance_PumpControl",
      "point": "rio_1/rio_1.do0",
      "dataType": "BOOL",
      "direction": "output"
    },
    {
      "variable": "ServoControlWord",
      "task": "FastControlTask",
      "instance": "instance_FastLoop",
      "point": "servo_1/servo_1.enable",
      "dataType": "UINT16",
      "direction": "output"
    }
  ]
}
```

## 4. 分块说明

### 4.1 configuration

结构沿用 v1 的三层，改了两处命名：`resources[].target` 改成 `deviceId`，任务下面的 `programs` 改成 `instances`。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `configuration.name` | 是 | IEC 配置名，生成 `CONFIGURATION` |
| `resources[].name` | 是 | 资源名，生成 `RESOURCE` |
| `resources[].deviceId` | 是 | 资源跑在哪台设备上，指向 `devices[].id` |
| `resources[].tasks[]` | 是 | 调度单位，至少一个 |
| `tasks[].name` | 是 | 任务名，生成 `TASK` |
| `tasks[].type` | 是 | `cyclic` 或 `event` |
| `tasks[].periodMs` | cyclic 必填 | 周期，毫秒，必须大于 0 |
| `tasks[].priority` | 是 | 调度优先级，0 到 31 |
| `tasks[].cpuCore` | 是 | 运行时绑核，不写进 ST |
| `tasks[].trigger` | event 必填 | 触发条件，cyclic 任务不允许出现 |
| `tasks[].instances[]` | 是 | 挂在这个任务下的程序实例，至少一个 |

实例字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 实例名，IEC 标识符，配置内唯一 |
| `pou` | 是 | 程序类型名，对应 `.st` 里的 `PROGRAM` 名 |
| `source` | 是 | 源文件相对路径，不能是绝对路径，不能带 `..` |
| `retain` | 否 | 是否保持，默认 false |

实例挂在任务下面，是上下级关系，不是平级引用。这和 IEC 的语义一致：实例必须由某个任务调用才会运行，脱离任务的实例是死代码。这也和 PLCopen XML 的结构一致，`pouInstance` 是 `task` 的子元素：

```xml
<task name="MainTask" interval="T#20ms" priority="1">
  <pouInstance name="instance_Main" typeName="Main"/>
</task>
```

一个 PROGRAM 类型可以有多个实例，每个实例有自己独立的变量内存，所以 `instances` 是数组。`pou` 相同的两个实例互不干扰：

```json
{
  "instances": [
    { "name": "instance_MotorA", "pou": "Motor", "source": "src/Motor.st" },
    { "name": "instance_MotorB", "pou": "Motor", "source": "src/Motor.st" }
  ]
}
```

`deviceId` 最终生成 matiec 的 `RESOURCE <name> ON <deviceId>`，所以它必须是 IEC 标识符，不能带横杠、点号、中文。

没有设备块时（v1 升级上来的文件），`deviceId` 沿用 v1 的字符串原样，不做迁移，也不报错。

v1 到 v2 的字段对应：`programs` → `instances`，`instanceName` → `name`，`typeName` → `pou`，`target` → `deviceId`。语义没变，只是命名统一。

### 4.2 pous

POU 清单，顶层与 `configuration` 平级。只存索引，不存正文。

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | POU 名，IEC 标识符，配置内唯一 |
| `pouType` | 是 | `program` / `functionBlock` / `function` |
| `source` | 是 | 源文件相对路径，多个 POU 可以指向同一个文件 |

三条约束。

第一，不存 `interface` 和 `body`。变量声明和代码正文都在 `.st` 文件里，这里再存一份就会分叉。导出 PLCopen XML 时按 `source` 去读文件补上。

第二，按 POU 条目而不是按文件。一个 `.st` 文件里可以写多个 POU，每个都要单独列一条，`source` 相同是正常的。

第三，`instances[].pou` 必须能在 `pous[].name` 里找到。这条校验把"实例引用的类型"和"实际存在的 POU"绑在一起，避免配了一个不存在的程序名。

它和 `instances` 的区别要说清楚，两者容易混：

- `pous` 是类型清单，回答"这个工程里有哪些程序单元"，包含没被任何任务绑定的 FUNCTION_BLOCK 和 FUNCTION。
- `instances` 是运行时实体，回答"哪个类型被实例化了、挂在哪个任务下"。只有 PROGRAM 能进 `instances`，FUNCTION_BLOCK 和 FUNCTION 不进。

所以 `pous` 里通常比 `instances` 多出几项，多出来的就是被调用的功能块和函数。

没有 `pous` 块时，`instances[].pou` 不做交叉校验，只按 `source` 去文件里找同名 `PROGRAM`，行为和 v1 一致。

### 4.3 devices

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 设备唯一标识，IEC 标识符，被 `resource.deviceId` 和 `ioMappings.point` 引用 |
| `name` | 否 | 展示名，可中文 |
| `role` | 是 | `local`（本机 CPU）或 `remote`（从站设备） |
| `model` | 是 | 设备型号，来自 devuni 建工程时选的型号或用户填写 |
| `vendor` | 否 | 厂商 |
| `firmware` | 否 | 固件版本 |
| `runtime` | 否 | 本机运行时能力：`coreCount`、`memoryMb` |
| `modules` | 否 | 扩展模块，只有本机 CPU 用 |
| `points` | 是 | 可用点位，至少一个 |
| `connections` | 否 | 这台设备挂在哪几条网络上 |

模块字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 模块标识，设备内唯一 |
| `slot` | 是 | 槽位号，整数 |
| `model` | 是 | 模块型号 |
| `kind` | 是 | `digitalInput` / `digitalOutput` / `analogInput` / `analogOutput` / `mixed` |
| `channels` | 是 | 通道数 |
| `range` | 否 | 模拟量量程，如 `0..10V`、`4..20mA` |
| `resolutionBits` | 否 | 分辨率位数 |

点位字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 点位标识，设备内唯一 |
| `address` | 是 | 字符串或对象，见下 |
| `direction` | 是 | `input` / `output` |
| `dataType` | 是 | IEC 类型：`BOOL`、`INT`、`UINT`、`REAL` 等；协议侧另用 `UINT16`、`INT16` 等 |
| `module` | 否 | 所属模块 id |
| `channel` | 否 | 模块内通道号 |
| `range` | 否 | 该通道的量程 |
| `description` | 否 | 中文说明，界面上显示 |

地址有两种形态，不要混用：

```json
"%IX0.0"
```

用于本机 IO，走 IEC 直接地址，直接进 `VAR_CONFIG`。

```json
{
  "network": "mb_rtu_1",
  "unitId": 1,
  "area": "holdingRegister",
  "offset": 8192,
  "dataType": "UINT16"
}
```

用于远程 IO。`area` 取 `coil`、`discreteInput`、`holdingRegister`、`inputRegister`；EtherCAT 用 `slaveIndex` + `index` + `subIndex`，不用 `area`/`offset`。

### 4.4 networks

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 网络唯一标识，被 `devices[].connections[].networkId` 和点位地址引用 |
| `name` | 否 | 展示名 |
| `protocol` | 是 | `modbusTcp` / `modbusRtu` / `ethercat` / `opcUa` / `profinet` |
| `role` | 是 | `master` / `slave` |
| `interface` | 否 | 本机网口：`name`、`ip`、`netmask`、`gateway` |
| `serial` | RTU 必填 | `port`、`baudRate`、`dataBits`、`parity`、`stopBits` |
| `host` / `port` | TCP 必填 | 对端地址与端口 |
| `timeoutMs` | 否 | 单次请求超时 |
| `retries` | 否 | 重试次数 |
| `pollIntervalMs` | 否 | 主站轮询间隔 |
| `cycleMs` | EtherCAT 必填 | 总线周期 |
| `distributedClock` | 否 | 是否启用分布式时钟 |

网络只描述链路本身。站表不在这里重复写，设备通过 `connections` 声明自己挂在哪条链路上、站号多少。这样一个从站只有一个地方配置，不会出现网络里删了、设备里还留着的情况。

### 4.5 ioMappings

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `variable` | 是 | ST 里的变量名，IEC 标识符 |
| `task` | 是 | 任务名 |
| `instance` | 是 | 程序实例名，`task` + `instance` 才能唯一定位 |
| `point` | 是 | `<deviceId>/<pointId>` |
| `dataType` | 是 | 变量类型 |
| `direction` | 是 | `input` / `output` |
| `scale` | 否 | 工程量换算系数，原始值乘它得到工程值 |
| `unit` | 否 | 工程单位 |
| `invert` | 否 | 布尔量取反 |

`point` 用斜杠拼接，是为了在 JSON 里保持一个字符串、方便搜索和差异比较。

映射不写进 `.st` 源文件。编译时生成到临时配置的 `VAR_CONFIG` 段：

```text
VAR_CONFIG
  instance_StartStopControl.StartButton AT %IX0.0 : BOOL;
  instance_PumpControl.OutletPressure AT %IW64 : INT;
END_VAR
```

远程点位不进 `VAR_CONFIG`，由运行时按 `ioMappings` 建立读写通道，程序里只看到变量名。

## 5. 校验规则

命名与唯一性：

- `device.id`、`network.id`、模块 `id`、点位 `id` 必须是 IEC 标识符。
- `device.id`、`network.id` 全局唯一。
- 同一设备内模块 `id` 唯一、槽位号唯一、点位 `id` 唯一。
- 同一网络内 `unitId` 唯一，EtherCAT 内 `slaveIndex` 唯一。
- `tasks[].instances[].name` 配置内唯一。`ioMappings` 要靠 `task` + `instance` 定位变量，重名会导致映射指错。
- 同一任务下实例名不能重复；不同任务之间也不建议重复，生成 `VAR_CONFIG` 时是 `实例名.变量名` 的格式，重名会指到错的实例。
- `pous[].name` 配置内唯一，且 `pouType` 只能是 `program`、`functionBlock`、`function`。
- `pous[].source` 与 `instances[].source` 用同一套相对路径规则，不能是绝对路径，不能带 `..`。

引用完整性：

- `resources[].deviceId` 必须能在 `devices[].id` 里找到；没有设备块时放行。
- 有 `pous` 块时，`tasks[].instances[].pou` 必须能在 `pous[].name` 里找到，且对应条目的 `pouType` 必须是 `program`。
- 没有 `pous` 块时，`tasks[].instances[].pou` 直接去 `source` 指向的 `.st` 文件里找同名 `PROGRAM`，这条在审计阶段核对，JSON 校验阶段读不到源码。
- `devices[].connections[].networkId` 必须能在 `networks[].id` 里找到。
- `ioMappings[].point` 的设备和点位都必须存在。
- `ioMappings[].task` + `ioMappings[].instance` 必须能在 configuration 里找到。
- `ioMappings[].variable` 是否真的声明在对应 POU 里，由审计工具在编译前核对，不在 JSON 校验阶段做，因为校验阶段读不到 ST 源码。

地址冲突：

- 同一个输出点位不能被两个变量映射。
- 同一个输入点位可以被多个变量读，不报错。
- 本机地址 `%IX`/`%QW` 之间的重叠（如 `%IW64` 与 `%ID64`）要按宽度检测。

类型匹配：

- 布尔点位只能映射到 `BOOL`。
- 模拟量点位映射到 `INT`、`UINT`、`REAL` 时，`scale` 必须提供，否则按原始值使用并在审计里提示。
- 协议侧 `dataType` 与变量类型不兼容时直接报错，不做静默截断。

## 6. TypeScript 类型

```ts
export type PlcTaskType = 'cyclic' | 'event';
export type PlcTriggerEdge = 'rising' | 'falling' | 'both';

export interface PlcEventTrigger {
  kind: 'variable';
  ref: string;
  edge?: PlcTriggerEdge;
}

export type PlcPouType = 'program' | 'functionBlock' | 'function';

export interface PlcPou {
  name: string;
  pouType: PlcPouType;
  source: string;
}

export interface PlcInstance {
  name: string;
  pou: string;
  source: string;
  retain?: boolean;
}

export interface PlcTask {
  name: string;
  type: PlcTaskType;
  periodMs?: number;
  priority: number;
  cpuCore: number;
  trigger?: PlcEventTrigger;
  instances: PlcInstance[];
}

export interface PlcResource {
  name: string;
  deviceId: string;
  tasks: PlcTask[];
}

export interface PlcConfiguration {
  name: string;
  resources: PlcResource[];
}

export interface PlcRuntimeConfigV2 {
  schemaVersion: 2;
  configuration: PlcConfiguration;
  pous?: PlcPou[];
  devices: PlcDevice[];
  networks: PlcNetwork[];
  ioMappings: PlcIoMapping[];
}

export type PlcDeviceRole = 'local' | 'remote';
export type PlcPointDirection = 'input' | 'output';
export type PlcModuleKind =
  | 'digitalInput' | 'digitalOutput'
  | 'analogInput' | 'analogOutput' | 'mixed';
export type PlcNetworkProtocol =
  | 'modbusTcp' | 'modbusRtu' | 'ethercat' | 'opcUa' | 'profinet';

export interface PlcIecAddress {
  kind: 'iec';
  address: string;
}

export interface PlcProtocolAddress {
  kind: 'protocol';
  network: string;
  unitId?: number;
  slaveIndex?: number;
  area?: 'coil' | 'discreteInput' | 'holdingRegister' | 'inputRegister';
  offset?: number;
  index?: string;
  subIndex?: number;
  dataType: string;
}

export interface PlcPoint {
  id: string;
  address: string | PlcProtocolAddress;
  direction: PlcPointDirection;
  dataType: string;
  module?: string;
  channel?: number;
  range?: string;
  description?: string;
}

export interface PlcModule {
  id: string;
  slot: number;
  model: string;
  kind: PlcModuleKind;
  channels: number;
  range?: string;
  resolutionBits?: number;
}

export interface PlcDeviceConnection {
  networkId: string;
  role: 'master' | 'slave';
  unitId?: number;
  slaveIndex?: number;
}

export interface PlcDevice {
  id: string;
  name?: string;
  role: PlcDeviceRole;
  model: string;
  vendor?: string;
  firmware?: string;
  runtime?: { coreCount?: number; memoryMb?: number };
  modules?: PlcModule[];
  points: PlcPoint[];
  connections?: PlcDeviceConnection[];
}

export interface PlcNetwork {
  id: string;
  name?: string;
  protocol: PlcNetworkProtocol;
  role: 'master' | 'slave';
  interface?: { name: string; ip?: string; netmask?: string; gateway?: string };
  serial?: {
    port: string;
    baudRate: number;
    dataBits: 5 | 6 | 7 | 8;
    parity: 'none' | 'even' | 'odd';
    stopBits: 1 | 2;
  };
  host?: string;
  port?: number;
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
  dataType: string;
  direction: PlcPointDirection;
  scale?: number;
  unit?: string;
  invert?: boolean;
}
```

`PlcIecAddress` 这一层只在代码里用，JSON 里本机地址直接写字符串，不需要 `kind` 字段。

## 7. 与 OpenPLC / matiec 的对应

| 本项目 | OpenPLC v4 领域模型 | matiec / PLCopen XML |
| --- | --- | --- |
| `configuration` | `PLCProjectData` + `PLCTask` / `PLCInstance` | `CONFIGURATION` / `RESOURCE` / `TASK` / `PROGRAM ... WITH ...` |
| `devices` | `DeviceConfiguration` | 无对应，运行时扩展 |
| `ioMappings` 中的本机地址 | `DevicePinMapping` | `VAR_CONFIG` / `AT %IX` 声明 |
| `ioMappings` 中的协议地址 | `DeviceConfiguration` 的 Modbus 子配置 | 无对应，运行时扩展 |
| `networks` | `DeviceConfiguration` 的协议子配置 | 无对应，运行时扩展 |
| `pous` | `PLCProjectData.pous` 的索引部分 | `<types><pous><pou name pouType>` |
| `.st` 里的 POU 正文 | `PLCPou` 的 `interface` 和 `body` | `<interface>` 和 `<body>` |

OpenPLC v4 返回工程时，`projectData`、`deviceConfiguration`、`devicePinMapping` 是三块平级数据。v2 的 `configuration`、`devices`+`networks`、`ioMappings` 正好一一对应，将来做导入导出不用改结构。

`pous` 只对应 `PLCPou` 的名字和类型，正文不在 JSON 里。导出 PLCopen XML 时按 `source` 读 `.st` 文件，把变量声明和代码填进 `<interface>` 和 `<body>`。

本机点位翻译成 `VAR_CONFIG`，远程点位翻译成运行时的通道表，这两条路不能混。`VAR_CONFIG` 只认 IEC 直接地址，塞不进 Modbus 寄存器。

## 8. 演进规则

以后加新协议或新设备类型时，按这几条走，不用再动结构：

- 新协议加进 `PlcNetworkProtocol` 联合类型，网络块只加该协议需要的可选字段，已有字段不改语义。
- 新设备类型复用 `devices`，靠 `role` 和 `points` 的地址形态区分，不新增顶层块。
- 需要描述"设备内部结构"时，用 `modules` 或新增可选的 `subDevices`，不要拆成新的顶层数组。
- 任何新增字段都必须是可选的，且旧版本读到新字段时只在 `schemaVersion` 上拒绝，不逐字段报错。
- 部署产物（编译后的设备树、寄存器表）不写回这个文件。

## 9. 落地顺序

1. `plcRuntimeConfig.ts` 拆成 `configuration`、`pous`、`devices`、`networks`、`ioMappings` 五个校验器，v1 文件走兼容分支。
2. 加 `schemaVersion` 版本路由：1 走旧路径，2 走新路径，大于 2 明确拒绝。
3. 审计工具增加四类检查：引用完整性、地址冲突、类型匹配、型号与建工程时选的是否一致。
4. `pous` 由扫描 `.st` 生成，不手工维护：每次审计重新扫一遍，新增文件补条目，删掉的文件移除条目。
5. 编译适配器增加 `VAR_CONFIG` 生成，远程点位生成运行时通道表。
6. 工具层增加设备/网络的增删改，仍然走 `request_clarification` 确认，不静默补默认值。
