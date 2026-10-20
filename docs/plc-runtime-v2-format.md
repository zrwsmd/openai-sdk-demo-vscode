# plc-runtime.json v2 格式

状态：格式提案，尚未实现。

## 1. 定位和边界

`plc-runtime.json` 是 PLC 工程的源配置。它描述任务调度、POU 索引、设备、网络和 IO 映射，不保存 ST 正文，也不是 `plc_config.json` 或部署包。

顶层结构固定为：

```json
{
  "schemaVersion": 2,
  "tasks": [],
  "pous": [],
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
| `devices` | 本地 PLC、扩展模块、远程设备和设备点位 |
| `networks` | Modbus、EtherCAT 等通信链路参数 |
| `ioMappings` | ST 变量与本地或远程点位之间的映射 |
| `runtimeOverrides` | 可选的高级运行时覆盖；普通工程不生成 |

POU 的变量声明和程序正文只存在于 `.st` 文件。JSON 不复制 `VAR`、`VAR RETAIN` 或实现代码。

编译时由目标适配器读取 v2，并分别生成：

- IEC 任务和实例配置；
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
| `type` | 是 | `cyclic` 或 `event` |
| `periodMs` | 是 | 周期/间隔，毫秒，必须大于 0 |
| `priority` | 是 | 优先级，0 到 31 |
| `cpuCore` | 是 | CPU 核编号，非负整数 |
| `instances` | 是 | 该 Task 调度的 PROGRAM 实例，至少一个 |

Task 直接放在顶层，因为当前 devUni 1.0.21 会把每个 Task 自动展开成一个 Resource。v2 不保存没有独立编辑意义的 Resource 外壳。

v2 不提供 `trigger`。当前 devUni 运行时的 event 任务只接收任务类型和正数 interval，没有可执行的触发器描述。不能把一个不会执行的 `trigger` 字段留在源配置中制造假能力。

v2 使用 `cyclic` 表达周期任务。devUni 构建接口的中间输入使用 `cycle`，原始 `plc_config.json` 又使用 `cyclic`，这两次转换由适配器完成：

```text
v2 cyclic -> devUni build input cycle -> plc_config.task_type cyclic
v2 event  -> devUni build input event -> plc_config.task_type event
```

### 3.1 Instance

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | PROGRAM 实例名，在所属 Task 内唯一 |
| `pou` | 是 | 被实例化的 PROGRAM POU 名，引用 `pous[].name` |

实例不再保存 `source`。源码位置只由 `pous[].source` 管理。

实例不再保存 `retain`。保持属性必须写在 ST 的 `VAR RETAIN` 中。

通用 v2 允许一个 PROGRAM 有多个不同实例。devUni 1.0.21 的构建接口会按 `instance_<POU名>` 生成实例名，因此使用该目标时适配器必须校验：

```text
instance.name == "instance_" + instance.pou
```

如果同一个 POU 在多个 Task 中需要多个实例，而目标运行时不支持自定义实例名，适配器必须明确报错，不能静默合并。

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

## 6. devices

### 6.1 Device

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

## 9. 校验规则

### 9.1 命名和源码

- 所有 Task 名、实例名和 POU 名必须是 IEC 标识符；
- `pous[].name` 不得包含点号；
- POU 名、文件名去掉扩展名后的名称、ST 内声明名必须大小写完全一致；
- `pous[].source` 必须唯一；
- devUni 目标下，POU 文件必须位于工作区根目录，不能放入子目录；
- `instances[].source`、`instances[].retain` 和 `tasks[].trigger` 都是不支持的字段。

### 9.2 引用完整性

- `tasks[].deviceId` 必须引用 `role: "local"` 的设备；
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

- 设备 id、网络 id、POU 名和 Task 名必须全局唯一，实例名按 Task 唯一；
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
- devUni 目标下实例名必须为 `instance_<POU名>`；
- 目标运行时不能执行的任务类型、协议或命名方式必须报错，不能只记录后继续编译。

## 10. TypeScript 类型

```ts
export type PlcTaskType = 'cyclic' | 'event';
export type PlcPouType = 'program' | 'functionBlock' | 'function';
export type PlcDeviceRole = 'local' | 'remote';
export type PlcPointDirection = 'input' | 'output';

export interface PlcRuntimeConfigV2 {
  schemaVersion: 2;
  runtimeOverrides?: PlcRuntimeOverrides;
  tasks: PlcTask[];
  pous: PlcPou[];
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
| `task.type: event` | 构建输入和原始输出均为 `event` |
| `task.periodMs` | 构建输入为 `periodMs * 1000` 微秒，原始 `plc_config.interval` 为 `periodMs * 1000000` 纳秒 |
| `task.cpuCore` | `cpu_core` |
| `task.priority` | `priority` |
| `instance.pou` | `instances[].type` |
| `instance_<pou>` | `instances[].name` |
| 本地 `ioMappings` | 生成 IEC `VAR_CONFIG` |
| 远程 `ioMappings` | 生成设备变量映射或 `var_mapped` |
| `devices`、`networks` | 生成 `device_tree` 和协议运行时配置 |
| `connections[].endpoint` | 写入 `device_tree[].config_file` 指向的独立 TCP 协议配置文件 |
| `connections[].unitId/slaveIndex` | 写入对应设备的 Modbus 或 EtherCAT 配置 |

devUni 当前固定生成：

```text
configuration_name = CONFIG_IEC
resource_name = resource_<Task名>
resource_on   = plc
```

适配器还负责把工作区根目录的 POU 源文件复制到 `.depworkspace`，再调用：

```text
start.exe -i <compileDir>
```

工具链路径、GCC 参数和编译缓存属于本机工具环境，不进入 v2。

## 12. 版本和兼容策略

- v2 文件必须包含 `tasks`、`pous`、`devices`、`networks`、`ioMappings`；没有设备、网络或映射时写空数组；
- `runtimeOverrides` 可选，迁移和普通 Agent 生成流程不得为了凑字段而添加；
- v1 读取后可迁移为 v2：将所有 Resource 下的 Task 展平到顶层，并把原 Resource 的目标设备迁移为 `task.deviceId`；
- v1 迁移必须显式补齐 `pous`、`devices`、`networks` 和 `ioMappings`；
- v1 的 `programs[].source` 迁移到唯一的 `pous[].source`；
- v1 的 `programs[].retain` 不迁移为实例字段，应检查 ST 源码中是否存在对应的 `VAR RETAIN`；
- 大于 2 的版本必须明确报“配置版本过新”，不能按 v2 猜测解析；
- 解析器应拒绝未知字段，避免拼写错误被静默忽略；
- 部署产物、编译生成文件和目标私有缓存不得反写进 v2。

## 13. 建议落地顺序

1. 实现顶层 Task 结构、可选运行时覆盖、严格校验器和 v1 到 v2 的显式迁移。
2. 实现 POU 源码扫描与名称、文件名、声明名一致性检查。
3. 实现 Task、实例、POU 引用和调度参数检查。
4. 实现本地 IO 地址冲突、类型、方向和数据区范围检查。
5. 实现设备、网络、协议地址和远程 IO 映射检查。
6. 实现 devUni 适配器，生成 `plc_config.json`、`VAR_CONFIG` 和设备变量映射。
7. 把审计、源码复制、配置生成和编译作为一个工程级事务执行。
