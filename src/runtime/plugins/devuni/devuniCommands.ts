/**
 * 外部 IDE 插件(devUni)接口声明表。
 *
 * 一条记录 = 一个对模型暴露的工具。要加新接口,就在这里多写一个
 * defineDevuniCommand({...});工厂、provider、宿主装配都不用改。
 *
 * 每条记录负责四件事:
 *   1. 模型看到什么      —— toolName / description / parameters
 *   2. 路由怎么找到它    —— capability(intents、risk、fallbackModes)
 *   3. 参数怎么翻译      —— buildArgs(模型参数 → 对方命令参数)
 *   4. 返回怎么翻译      —— toOutcome(对方返回值 → 给模型看的结论)
 */
import { z } from "zod";
import type { ToolResultAction } from "../../../protocol/results";
import {
  checkDirectoryPath,
  checkProjectName,
} from "../../clarificationInputRules";
import type { ToolCapability } from "../../toolCatalog";
import type { DevuniCommandPort } from "./devuniCommandPort";

/** 桥命令返回值归一化之后的样子。 */
export type DevuniCommandOutcome =
  | { ok: true; data: unknown; summary: string; actions?: ToolResultAction[] }
  | { ok: false; error: string; data?: unknown };

/**
 * SDK 的 tool() 只接受 ZodObject,所以这里跟着它的约束走。
 * 具体某条命令的参数类型由 defineDevuniCommand 的泛型保住,不会丢。
 */
type DevuniParametersSchema = z.ZodObject<any, any>;

export interface DevuniCommandDescriptor {
  readonly toolName: string;
  readonly bridgeCommand: string;
  readonly description: string;
  readonly capability: ToolCapability;
  readonly parameters: DevuniParametersSchema;
  readonly buildArgs: (input: unknown, port: DevuniCommandPort) => Promise<unknown>;
  readonly toOutcome: (raw: unknown, input: unknown) => DevuniCommandOutcome;
}

interface DevuniCommandSpec<TInput> {
  /** 暴露给模型的工具名。 */
  toolName: string;
  /** 对方扩展里注册的命令短名,见 vscode-command-bridge 的 COMMAND_REGISTRY。 */
  bridgeCommand: string;
  /** 给模型看的完整说明。 */
  description: string;
  /** 能力目录元数据:决定路由和审批。 */
  capability: ToolCapability;
  /** 模型可见的参数 schema。 */
  parameters: DevuniParametersSchema & z.ZodType<TInput>;
  /** 模型参数 → 对方命令参数。缺省时整个 input 原样透传。 */
  buildArgs?: (input: TInput, port: DevuniCommandPort) => unknown | Promise<unknown>;
  /** 对方返回值 → 给模型看的结论。 */
  toOutcome: (raw: unknown, input: TInput) => DevuniCommandOutcome;
}

/**
 * 把一条"带类型"的命令声明抹平成注册中心能吃的描述符。
 * 类型只在写声明的时候起作用,注册中心拿到的是一份统一形状。
 */
export function defineDevuniCommand<TInput>(
  spec: DevuniCommandSpec<TInput>,
): DevuniCommandDescriptor {
  return {
    toolName: spec.toolName,
    bridgeCommand: spec.bridgeCommand,
    description: spec.description,
    capability: spec.capability,
    parameters: spec.parameters,
    buildArgs: (input, port) =>
      Promise.resolve(
        spec.buildArgs ? spec.buildArgs(input as TInput, port) : input,
      ),
    toOutcome: (raw, input) => spec.toOutcome(raw, input as TInput),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export type DevuniOption = { id: string; name: string };

/** 对方返回的候选列表可能是 [{id,name}] 也可能是 ["st"]，两种都收。 */
function readOptionList(value: unknown): DevuniOption[] {
  if (!Array.isArray(value)) return [];
  const options: DevuniOption[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      options.push({ id: item, name: item });
      continue;
    }
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" && item.id.trim() ? item.id : undefined;
    if (!id) continue;
    const name = typeof item.name === "string" && item.name.trim() ? item.name : id;
    options.push({ id, name });
  }
  return options;
}

export interface DevuniProjectOptions {
  languages: DevuniOption[];
  machineList: DevuniOption[];
  projectType: DevuniOption[];
}

/** 读一次工程可选项;对方不可用或返回不完整时返回 undefined。 */
async function loadProjectOptions(
  port: DevuniCommandPort,
): Promise<DevuniProjectOptions | undefined> {
  const raw = await port.invoke("bridgeProjectInitInfo");
  if (!isRecord(raw) || raw.status !== true || !isRecord(raw.initInfo)) {
    return undefined;
  }
  const initInfo = raw.initInfo;
  return {
    languages: readOptionList(initInfo.languages),
    machineList: readOptionList(initInfo.machineList),
    projectType: readOptionList(initInfo.projectType),
  };
}

/* ------------------------------------------------------------------ */
/* 接口 1:查询新建工程可选项                                          */
/* ------------------------------------------------------------------ */

const projectOptionsCommand = defineDevuniCommand<Record<string, never>>({
  toolName: "devuni_project_options",
  bridgeCommand: "bridgeProjectInitInfo",
  description:
    "查询外部 devUni IDE 插件当前支持的工程语言、设备型号和工程类型。" +
    "当用户要新建工程但没有说清机型/语言/类型,或者你想确认某个机型是否被支持时先调用它。" +
    "只读查询,不会创建任何文件、不会切换窗口。",
  capability: {
    name: "devuni_project_options",
    description: "查询 devUni 插件支持的工程语言、设备型号和工程类型。",
    domain: "devuni",
    intents: [
      "查询支持哪些设备型号",
      "新建工程有哪些选项",
      "支持哪些工程语言",
      "有哪些工程类型",
      "查看可用的 PLC 机型",
    ],
    tags: ["devuni", "project", "configuration", "read"],
    risk: "read",
    effect: "none",
    fallbackModes: ["read_only"],
  },
  parameters: z.object({}),
  toOutcome: (raw) => {
    if (!isRecord(raw) || raw.status !== true || !isRecord(raw.initInfo)) {
      return {
        ok: false,
        error:
          "devUni 插件没有返回工程初始化信息。请确认同事的 devUni IDE 插件已安装并启用。",
        data: raw,
      };
    }
    const initInfo = raw.initInfo;
    const options: DevuniProjectOptions = {
      languages: readOptionList(initInfo.languages),
      machineList: readOptionList(initInfo.machineList),
      projectType: readOptionList(initInfo.projectType),
    };
    const list = (items: readonly DevuniOption[]): string =>
      items.length ? items.map((item) => item.id).join("/") : "(无)";
    return {
      ok: true,
      data: options,
      summary:
        `可用语言:${list(options.languages)};` +
        `设备型号:${list(options.machineList)};` +
        `工程类型:${list(options.projectType)}`,
    };
  },
});

/* ------------------------------------------------------------------ */
/* 接口 2:创建工程                                                     */
/* ------------------------------------------------------------------ */

const createProjectParameters = z.object({
  projectName: z
    .string()
    .min(1)
    .describe(
      '工程名称，会直接当作目录名用。不能包含 < > : " / \\ | ? *，不能以点或空格结尾，' +
        '不能用 CON/PRN/AUX/NUL/COM1-9/LPT1-9 这类系统保留名，最长 100 字符。',
    ),
  projectPath: z
    .string()
    .min(1)
    .describe(
      '工程要建在哪个父目录下。必须是已经存在的目录,例如 "E:\\\\"。注意这是父目录,工程本身会建成 <父目录>\\\\<工程名>。',
    ),
  deviceModel: z
    .string()
    .min(1)
    .describe("设备型号,必填。取值必须来自 devuni_project_options,不可省略或默默采用第一个可用型号。"),
  language: z
    .string()
    .min(1)
    .optional()
    .describe("工程语言,例如 st / ld / fbd。不填则用第一个可用语言。"),
  projectType: z
    .string()
    .min(1)
    .optional()
    .describe("工程类型,例如 standard / HMI。不填则用第一个可用类型。"),
});

type CreateProjectInput = z.infer<typeof createProjectParameters>;

const createProjectCommand = defineDevuniCommand<CreateProjectInput>({
  toolName: "devuni_create_project",
  bridgeCommand: "bridgeCreateProject",
  description:
    "在外部 devUni IDE 插件里创建一个真实工程(会在磁盘上生成工程目录、工作区文件、设备配置和默认 POU)。" +
    "当用户说新建工程、创建工程、建一个 PLC 工程、新建项目时使用。" +
    "projectPath 必须是已经存在的父目录。" +
    "工程类型、工程语言、设备型号、父目录或工程名不明确时,先用 request_clarification 逐项确认,不要依赖默认值。" +
    "设备型号是必填项,必须从 devuni_project_options 的候选中选择,不能使用插件默认型号代替用户确认。" +
    "创建成功后由运行时等待当前任务完整结束，再在新窗口打开工程并建立新的工程会话;" +
    "属于写操作,执行前需要用户在界面批准。",
  capability: {
    name: "devuni_create_project",
    description: "在外部 devUni IDE 插件里创建一个真实工程。",
    domain: "devuni",
    intents: [
      "新建工程",
      "创建工程",
      "建一个工程",
      "新建项目",
      "创建 PLC 工程",
      "生成一个工程",
    ],
    tags: ["devuni", "project", "write"],
    risk: "write",
    effect: "filesystem",
    fallbackModes: ["file_edit"],
  },
  parameters: createProjectParameters,
  buildArgs: async (input, port) => {
    // 名字和目录在弹窗里已经校验过一次，这里是最终判定：
    // 模型也可能绕过弹窗直接传参，非法名字建出来的目录很难收拾。
    const nameProblem = checkProjectName(input.projectName);
    if (nameProblem) {
      throw new Error(`工程名不合法:${nameProblem}。请换一个名字后重试。`);
    }
    const pathProblem = checkDirectoryPath(input.projectPath);
    if (pathProblem) {
      throw new Error(`工程父目录不合法:${pathProblem}。`);
    }
    // 语言/类型没给全时才去问对方要可选项;设备型号必须由模型先向用户确认。
    if (!input.deviceModel) {
      throw new Error(
        "设备型号是创建工程的必填项,请先通过 request_clarification 让用户从 devuni_project_options 的候选中选择。",
      );
    }
    const needsDefaults =
      !input.language || !input.projectType;
    const options = needsDefaults ? await loadProjectOptions(port) : undefined;

    const deviceModel = input.deviceModel;
    const language = input.language ?? options?.languages[0]?.id;
    const projectType = input.projectType ?? options?.projectType[0]?.id;

    const missing: string[] = [];
    if (!deviceModel) missing.push("设备型号");
    if (!language) missing.push("工程语言");
    if (!projectType) missing.push("工程类型");
    if (missing.length) {
      throw new Error(
        `无法确定${missing.join("、")}:devUni 插件没有返回可选项。` +
          "请在参数里显式指定这几项,或先确认同事的 devUni IDE 插件已安装并启用。",
      );
    }

    return {
      projectName: input.projectName,
      projectPath: input.projectPath,
      deviceModel,
      // 对方命令里叫 lan,不是 language。
      lan: language,
      prjType: projectType,
      // 窗口接力由宿主在整轮任务完成后执行，创建命令本身绝不能提前切走。
      openAfterCreate: false,
    };
  },
  toOutcome: (raw) => {
    if (!isRecord(raw)) {
      return { ok: false, error: "devUni 插件返回了无法识别的内容。", data: raw };
    }
    if (raw.status !== true) {
      const detail = typeof raw.error === "string" ? raw.error : undefined;
      return {
        ok: false,
        error: detail
          ? `创建工程失败:${detail}`
          : "创建工程失败。常见原因:父目录不存在、工程名里含 \".\"、" +
            "同路径下已有同名工程、设备型号不在支持列表里。",
        data: raw,
      };
    }
    return {
      ok: true,
      // wsUri is an internal handoff detail. The host keeps it for opening the
      // new window, but exposing it here makes the model treat the workspace
      // descriptor as the project directory and cross the authorization boundary.
      data: { projectCreated: true, opened: false },
      summary: "工程已创建，宿主将在本轮结束后自动在新窗口打开。",
    };
  },
});

/**
 * 全部对外接口。加新接口只需要往这个数组里加一条。
 */
export const DEVUNI_COMMANDS: readonly DevuniCommandDescriptor[] = [
  projectOptionsCommand,
  createProjectCommand,
];
