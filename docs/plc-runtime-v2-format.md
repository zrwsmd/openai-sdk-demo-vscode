# plc-runtime.json v2 格式

状态：格式提案，尚未实现。

## 1. 定位和边界

`plc-runtime.json` 是 PLC 工程的源配置。它描述任务调度、POU 索引、设备、网络和 IO 映射，不保存 ST 正文，也不是 `plc_config.json` 或部署包。

顶层结构固定为：

```json
{
  "schemaVersion": 2,
  "configuration": {},
  "pous": [],
  "devices": [],
  "networks": [],
  "ioMappings": []
}
```

各部分职责：

| 部分 | 职责 |
| --- | --- |
| `configuration` | 数据区、保持策略、Resource、Task 和程序实例 |
| `pous` | POU 名称、类型和对应的 ST 源文件索引 |
| `devices` | 本地 PLC、扩展模块、远程设备和设备点位 |
| `networks` | Modbus、EtherCAT 等通信链路参数 |
| `ioMappings` | ST 变量与本地或远程点位之间的映射 |

POU 的变量声明和程序正文只存在于 `.st` 文件。JSON 不复制 `VAR`、`VAR RETAIN` 或实现代码。

编译时由目标适配器读取 v2，并分别生成：

- IEC 任务和实例配置；
- 本地点位的 `VAR_CONFIG`；
- 远程点位的设备变量映射；
- devUni 的 `plc_config.json` 和编译工作目录；
- 其他运行时需要的设备树、网络配置或部署清单。

## 2. 完整示例

下面的示例覆盖 v2 的全部结构。可选字段在没有值时直接省略，不写 `null`。

```json
{
  "schemaVersion": 2,
  "configuration": {
    "name": "CONFIG_IEC",
    "dataArea": {
      "input": 4096,
      "output": 4096,
      "memory": 4096
    },
    "retainPolicy": {
      "enabled": false,
      "intervalMs": 10000
    },
    "resources": [
      {
        "name": "MainResource",
        "deviceId": "cpu_main",
        "tasks": [
          {
            "name": "FastTask",
            "type": "cyclic",
            "periodMs": 5,
            "priority": 0,
            "cpuCore": 0,
            "instances": [
              {
                "name": "instance_FastLoop",
                "pou": "FastLoop"
              }
            ]
          },
          {
            "name": "MainTask",
            "type": "cyclic",
            "periodMs": 20,
            "priority": 1,
            "cpuCore": 1,
            "instances": [
              {
                "name": "instance_Main",
                "pou": "Main"
              }
            ]
          },
          {
            "name": "EventTask",
            "type": "event",
            "periodMs": 100,
            "priority": 2,
            "cpuCore": 1,
            "instances": [
              {
                "name": "instance_AlarmHandler",
                "pou": "AlarmHandler"
              }
            ]
          }
        ]
      }
    ]
  },
  "pous": [
    { "name": "FastLoop", "pouType": "program", "source": "FastLoop.st" },
    { "name": "Main", "pouType": "program", "source": "Main.st" },
    { "name": "AlarmHandler", "pouType": "program", "source": "AlarmHandler.st" },
    { "name": "MotorControl", "pouType": "functionBlock", "source": "MotorControl.st" },
    { "name": "ScaleValue", "pouType": "function", "source": "ScaleValue.st" }
  ],
  "devices": [
    {
      "id": "cpu_main",
      "name": "主控制器",
      "role": "local",
      "model": "SC5100",
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
          "address": "%IX0.0",
          "direction": "input",
          "dataType": "BOOL",
          "module": "di_16",
          "channel": 0,
          "description": "启动按钮"
        },
        {
          "id": "ai_8.ch0",
          "address": "%IW64",
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
      "vendor": "INVT",
      "points": [
        {
          "id": "freq_set",
          "address": {
            "kind": "protocol",
            "networkId": "mb_rtu_1",
            "unitId": 1,
            "area": "holdingRegister",
            "offset": 8192,
            "dataType": "UINT16"
          },
          "direction": "output",
          "dataType": "UINT16",
          "description": "频率给定"
        }
      ],
      "connections": [
        { "networkId": "mb_rtu_1", "role": "slave", "unitId": 1 }
      ]
    },
    {
      "id": "servo_1",
      "name": "1 号伺服",
      "role": "remote",
      "model": "SV660",
      "points": [
        {
          "id": "control_word",
          "address": {
            "kind": "protocol",
            "networkId": "ecat_1",
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
        { "networkId": "ecat_1", "role": "slave", "slaveIndex": 1 }
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
      "dataType": "BOOL",
      "direction": "input",
      "invert": false
    },
    {
      "variable": "OutletPressure",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "cpu_main/ai_8.ch0",
      "dataType": "INT",
      "direction": "input",
      "scale": 0.01,
      "unit": "MPa"
    },
    {
      "variable": "FrequencySetpoint",
      "task": "MainTask",
      "instance": "instance_Main",
      "point": "vfd_1/freq_set",
      "dataType": "UINT16",
      "direction": "output",
      "scale": 100,
      "unit": "Hz"
    },
    {
      "variable": "ServoControlWord",
      "task": "FastTask",
      "instance": "instance_FastLoop",
      "point": "servo_1/control_word",
      "dataType": "UINT16",
      "direction": "output"
    }
  ]
}
```

## 3. configuration

### 3.1 基本字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | IEC 配置名，必须是 IEC 标识符 |
| `dataArea` | 是 | 运行时 I/Q/M 数据区大小 |
| `retainPolicy` | 是 | 保持变量的运行时持久化策略，不声明哪些变量需要保持 |
| `resources` | 是 | 逻辑资源和任务清单，至少一个 |

`dataArea` 三个字段均为非负整数，v2 统一以字节表示：

| 字段 | 含义 |
| --- | --- |
| `input` | 输入区大小 |
| `output` | 输出区大小 |
| `memory` | 内存区大小 |

`retainPolicy`：

| 字段 | 含义 |
| --- | --- |
| `enabled` | 是否启用运行时周期持久化 |
| `intervalMs` | 持久化周期，毫秒；必须大于 0 |

需要保持的变量必须在 ST 源码中使用 `VAR RETAIN` 声明。`retainPolicy` 只控制运行时如何刷新保持区，不能替代源码声明。

### 3.2 Resource

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | v2 中的逻辑资源名，IEC 标识符 |
| `deviceId` | 是 | 逻辑资源所属设备，引用 `devices[].id` |
| `tasks` | 是 | Task 数组，至少一个 |

`name` 和 `deviceId` 是工程模型字段，不保证原样下发到每个目标。devUni 1.0.21 会为每个 Task 单独生成一个资源：

```text
resource_name = "resource_" + task.name
resource_on   = "plc"
```

因此 devUni 适配器不会把 v2 的 `resources[].name` 和 `resources[].deviceId` 原样写入这两个目标字段，但仍使用 `deviceId` 做设备引用、IO 映射和一致性校验。

### 3.3 Task

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | Task 名，IEC 标识符 |
| `type` | 是 | `cyclic` 或 `event` |
| `periodMs` | 是 | 周期/间隔，毫秒，必须大于 0 |
| `priority` | 是 | 优先级，0 到 31 |
| `cpuCore` | 是 | CPU 核编号，非负整数 |
| `instances` | 是 | 该 Task 调度的 PROGRAM 实例，至少一个 |

v2 不提供 `trigger`。当前 devUni 运行时的 event 任务只接收任务类型和正数 interval，没有可执行的触发器描述。不能把一个不会执行的 `trigger` 字段留在源配置中制造假能力。

v2 使用 `cyclic` 表达周期任务。devUni 构建接口的中间输入使用 `cycle`，原始 `plc_config.json` 又使用 `cyclic`，这两次转换由适配器完成：

```text
v2 cyclic -> devUni build input cycle -> plc_config.task_type cyclic
v2 event  -> devUni build input event -> plc_config.task_type event
```

### 3.4 Instance

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | PROGRAM 实例名，配置内唯一 |
| `pou` | 是 | 被实例化的 PROGRAM POU 名，引用 `pous[].name` |

实例不再保存 `source`。源码位置只由 `pous[].source` 管理。

实例不再保存 `retain`。保持属性必须写在 ST 的 `VAR RETAIN` 中。

通用 v2 允许一个 PROGRAM 有多个不同实例。devUni 1.0.21 的构建接口会按 `instance_<POU名>` 生成实例名，因此使用该目标时适配器必须校验：

```text
instance.name == "instance_" + instance.pou
```

如果同一个 POU 在多个 Task 中需要多个实例，而目标运行时不支持自定义实例名，适配器必须明确报错，不能静默合并。

## 4. pous

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | POU 声明名，配置内唯一 |
| `pouType` | 是 | `program`、`functionBlock` 或 `function` |
| `source` | 是 | 工作区相对的 `.st` 源文件路径 |

`source` 只在 `pous` 中出现一次。保留它是为了让审计器、编辑器和不同目标适配器能可靠定位源码；`instances` 只引用 POU 名。

通用规则：

- `name` 必须是 IEC 标识符，不能包含点号、斜杠或扩展名；
- `source` 不能是绝对路径，不能包含 `.` 或 `..` 路径段；
- `source` 必须以 `.st` 结尾；
- POU 名、文件名去掉 `.st` 后的名称、ST 内的声明名必须完全一致，包括大小写；
- 一个 `source` 只允许对应一个 `pous` 条目。

当前 devUni 1.0.21 只扫描工作区根目录第一层的 `*.st`，不递归扫描子目录，因此 devUni 目标额外要求：

```text
source == name + ".st"
```

例如 `Main` 只能对应工作区根目录下的 `Main.st`，不能写成 `src/Main.st`。这是 devUni 适配限制，不是其他目标适配器必须永久遵守的全局限制。

## 5. devices

### 5.1 Device

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 设备唯一标识，被 Resource、连接和点位引用 |
| `name` | 否 | 展示名，可以使用中文 |
| `role` | 是 | `local` 或 `remote` |
| `model` | 是 | 设备型号 |
| `vendor` | 否 | 厂商 |
| `firmware` | 否 | 固件版本 |
| `runtime` | 否 | 本地控制器能力 |
| `modules` | 否 | 扩展模块数组 |
| `points` | 是 | 设备点位数组，可以为空 |
| `connections` | 否 | 设备使用的网络连接 |

`runtime` 字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `coreCount` | 否 | CPU 核数，正整数 |
| `memoryMb` | 否 | 可用内存，MB，正整数 |

### 5.2 Module

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 模块标识，设备内唯一 |
| `slot` | 是 | 槽位号，非负整数 |
| `model` | 是 | 模块型号 |
| `kind` | 是 | `digitalInput`、`digitalOutput`、`analogInput`、`analogOutput` 或 `mixed` |
| `channels` | 是 | 通道数，正整数 |
| `range` | 否 | 模拟量量程 |
| `resolutionBits` | 否 | 模拟量分辨率位数 |

### 5.3 Point

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 点位标识，设备内唯一 |
| `address` | 是 | 本地 IEC 地址字符串或远程协议地址对象 |
| `direction` | 是 | `input` 或 `output` |
| `dataType` | 是 | IEC 变量类型 |
| `module` | 否 | 所属模块 id |
| `channel` | 否 | 模块通道号 |
| `range` | 否 | 量程 |
| `description` | 否 | 展示说明 |

本地点位地址直接使用 IEC 地址字符串：

```json
"%IX0.0"
```

远程协议地址使用对象：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `kind` | 是 | 固定为 `protocol` |
| `networkId` | 是 | 引用 `networks[].id` |
| `unitId` | Modbus 从站需要 | Modbus 站号 |
| `slaveIndex` | EtherCAT 从站需要 | EtherCAT 从站序号 |
| `area` | Modbus 需要 | `coil`、`discreteInput`、`holdingRegister`、`inputRegister` |
| `offset` | Modbus 需要 | 寄存器或线圈偏移 |
| `index` | EtherCAT 对象需要 | 对象字典索引，如 `0x6040` |
| `subIndex` | EtherCAT 对象需要 | 对象字典子索引 |
| `dataType` | 是 | 协议侧数据类型 |

### 5.4 Connection

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `networkId` | 是 | 引用 `networks[].id` |
| `role` | 是 | `master` 或 `slave` |
| `unitId` | Modbus 从站需要 | Modbus 站号 |
| `slaveIndex` | EtherCAT 从站需要 | EtherCAT 从站序号 |

## 6. networks

公共字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | 是 | 网络唯一标识 |
| `name` | 否 | 展示名 |
| `protocol` | 是 | `modbusTcp`、`modbusRtu`、`ethercat`、`opcUa` 或 `profinet` |
| `role` | 是 | `master` 或 `slave` |
| `timeoutMs` | 否 | 单次请求超时 |
| `retries` | 否 | 重试次数 |
| `pollIntervalMs` | 否 | 主站轮询间隔 |

协议字段：

| 字段 | 使用场景 | 说明 |
| --- | --- | --- |
| `interface` | TCP、EtherCAT、Profinet | `name` 必填，`ip`、`netmask`、`gateway` 可选 |
| `serial` | Modbus RTU | `port`、`baudRate`、`dataBits`、`parity`、`stopBits` |
| `host` | Modbus TCP、OPC UA | 对端地址 |
| `port` | Modbus TCP、OPC UA | 对端端口 |
| `cycleMs` | EtherCAT | 总线周期，毫秒 |
| `distributedClock` | EtherCAT | 是否启用分布式时钟 |

设备归属不在网络里重复保存。设备通过 `connections` 声明自己接入哪条网络。

## 7. ioMappings

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `variable` | 是 | 对应 PROGRAM 实例中的变量名 |
| `task` | 是 | Task 名 |
| `instance` | 是 | PROGRAM 实例名 |
| `point` | 是 | `<deviceId>/<pointId>` |
| `dataType` | 是 | ST 变量类型 |
| `direction` | 是 | `input` 或 `output` |
| `scale` | 否 | 原始值到工程值的缩放系数 |
| `unit` | 否 | 工程单位 |
| `invert` | 否 | BOOL 是否取反，默认 false |

`ioMappings` 同时保存本地点和远程点，但适配器必须按点位地址类型走不同通道。

### 7.1 本地点

本地点的 `devices[].points[].address` 是 `%IX`、`%QX`、`%IW` 等 IEC 直接地址。适配器将映射生成到 `VAR_CONFIG`：

```text
VAR_CONFIG
  instance_Main.StartButton AT %IX0.0 : BOOL;
  instance_Main.OutletPressure AT %IW64 : INT;
END_VAR
```

### 7.2 远程点

远程点的地址是协议对象。适配器不能把 Modbus 寄存器或 EtherCAT 对象硬塞进 `VAR_CONFIG`，而应生成目标运行时的设备变量映射、驱动通道或 `var_mapped`。

## 8. 校验规则

### 8.1 命名和源码

- 所有配置名、资源名、Task 名、实例名和 POU 名必须是 IEC 标识符；
- `pous[].name` 不得包含点号；
- POU 名、文件名去掉扩展名后的名称、ST 内声明名必须大小写完全一致；
- `pous[].source` 必须唯一；
- devUni 目标下，POU 文件必须位于工作区根目录，不能放入子目录；
- `instances[].source`、`instances[].retain` 和 `tasks[].trigger` 都是不支持的字段。

### 8.2 引用完整性

- `resources[].deviceId` 必须引用存在的 `devices[].id`；
- `instances[].pou` 必须引用 `pouType: "program"` 的 POU；
- `connections[].networkId` 和协议地址的 `networkId` 必须引用存在的网络；
- `ioMappings[].task` 和 `instance` 必须能定位到唯一实例；
- `ioMappings[].point` 中的设备和点位必须存在；
- `ioMappings[].variable` 必须在实例对应的 PROGRAM 中声明；
- IO 映射的数据类型和方向必须与设备点位兼容。

### 8.3 唯一性和冲突

- 设备 id、网络 id、POU 名、Task 名和实例名按各自作用域唯一；
- 同一设备内模块 id、槽位号和点位 id 唯一；
- 同一个输出点不能映射给多个变量；
- 输入点允许多个变量只读，但应给出重复映射提示；
- 本地 IEC 地址不能发生位宽重叠；
- 同一 Modbus 网络内 `unitId` 唯一，同一 EtherCAT 网络内 `slaveIndex` 唯一。

### 8.4 调度和运行时

- `periodMs` 必须大于 0；
- `priority` 必须为 0 到 31 的整数；
- `cpuCore` 必须小于目标设备的 `runtime.coreCount`；
- `dataArea` 三个值必须为非负整数；
- 数据区必须能容纳全部本地 IEC 地址；
- devUni 目标下实例名必须为 `instance_<POU名>`；
- 目标运行时不能执行的任务类型、协议或命名方式必须报错，不能只记录后继续编译。

## 9. TypeScript 类型

```ts
export type PlcTaskType = 'cyclic' | 'event';
export type PlcPouType = 'program' | 'functionBlock' | 'function';
export type PlcDeviceRole = 'local' | 'remote';
export type PlcPointDirection = 'input' | 'output';

export interface PlcRuntimeConfigV2 {
  schemaVersion: 2;
  configuration: PlcConfiguration;
  pous: PlcPou[];
  devices: PlcDevice[];
  networks: PlcNetwork[];
  ioMappings: PlcIoMapping[];
}

export interface PlcConfiguration {
  name: string;
  dataArea: { input: number; output: number; memory: number };
  retainPolicy: { enabled: boolean; intervalMs: number };
  resources: PlcResource[];
}

export interface PlcResource {
  name: string;
  deviceId: string;
  tasks: PlcTask[];
}

export interface PlcTask {
  name: string;
  type: PlcTaskType;
  periodMs: number;
  priority: number;
  cpuCore: number;
  instances: PlcInstance[];
}

export interface PlcInstance { name: string; pou: string }
export interface PlcPou { name: string; pouType: PlcPouType; source: string }

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

export interface PlcProtocolAddress {
  kind: 'protocol';
  networkId: string;
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

export type PlcNetworkProtocol =
  | 'modbusTcp' | 'modbusRtu' | 'ethercat' | 'opcUa' | 'profinet';

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

## 10. devUni 1.0.21 转换规则

v2 不是 devUni 的 `plc_config.json`。适配器按下表转换：

| v2 | devUni 输入/输出 |
| --- | --- |
| `configuration.name` | `configuration.configuration_name` |
| `configuration.dataArea` | 顶层 `data_area` |
| `configuration.retainPolicy.enabled` | `retain.cyclic` |
| `configuration.retainPolicy.intervalMs` | `retain.interval` |
| 每个 `tasks[]` | 一个原始 `configuration.resources[]` |
| `task.name` | `task_name` |
| `task.type: cyclic` | 构建输入 `cycle`，原始输出 `task_type: cyclic` |
| `task.type: event` | 构建输入和原始输出均为 `event` |
| `task.periodMs` | 构建输入为 `periodMs * 1000` 微秒，原始 `plc_config.interval` 为 `periodMs * 1000000` 纳秒 |
| `task.cpuCore` | `cpu_core` |
| `task.priority` | `priority` |
| `instance.pou` | `instances[].type` |
| `instance_<pou>` | `instances[].name` |
| 本地 `ioMappings` | 生成 IEC `VAR_CONFIG` |
| 远程 `ioMappings` | 生成设备变量映射或 `var_mapped` |
| `devices`、`networks` | 生成 `device_tree` 和协议运行时配置 |

devUni 当前固定生成：

```text
resource_name = resource_<Task名>
resource_on   = plc
```

适配器还负责把工作区根目录的 POU 源文件复制到 `.depworkspace`，再调用：

```text
start.exe -i <compileDir>
```

工具链路径、GCC 参数和编译缓存属于本机工具环境，不进入 v2。

## 11. 版本和兼容策略

- v2 文件必须包含五个顶层业务块；没有设备、网络或映射时写空数组；
- v1 读取后可迁移为 v2，但必须显式补齐 `pous`、`devices`、`networks`、`ioMappings`、`dataArea` 和 `retainPolicy`；
- v1 的 `programs[].source` 迁移到唯一的 `pous[].source`；
- v1 的 `programs[].retain` 不迁移为实例字段，应检查 ST 源码中是否存在对应的 `VAR RETAIN`；
- 大于 2 的版本必须明确报“配置版本过新”，不能按 v2 猜测解析；
- 解析器应拒绝未知字段，避免拼写错误被静默忽略；
- 部署产物、编译生成文件和目标私有缓存不得反写进 v2。

## 12. 建议落地顺序

1. 实现 v2 类型、严格校验器和 v1 到 v2 的显式迁移。
2. 实现 POU 源码扫描与名称、文件名、声明名一致性检查。
3. 实现 Task、实例、POU 引用和调度参数检查。
4. 实现本地 IO 地址冲突、类型、方向和数据区范围检查。
5. 实现设备、网络、协议地址和远程 IO 映射检查。
6. 实现 devUni 适配器，生成 `plc_config.json`、`VAR_CONFIG` 和设备变量映射。
7. 把审计、源码复制、配置生成和编译作为一个工程级事务执行。
