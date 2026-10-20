/**
 * devuni 工程事务工作流。
 *
 * 它认领的是工程生命周期事务(新建、打开、关闭、改名……),不是所有提到
 * 工程/项目的请求。写文件、读配置或运行命令时,工程名只是目标上下文。现在真正挂上去的工具只有查询和创建
 * 两个;等同事那边把关闭、改名等接口放出来,只要往 DEVUNI_COMMANDS 里加一条,
 * 工具名单会自动跟上,这个文件一个字都不用改。
 *
 * 为什么需要它:这类请求以前没有任何工作流认领,会掉进模型分诊,被塞进
 * 只读 / 普通问答 / 需要澄清之类的档位。那几个档位有硬性的风险过滤(只放
 * read 和 plan),而创建工程这个工具的风险是 write,连候选都进不去;即使
 * 侥幸落进"普通文件修改"档,还会被文本收窄再削一遍。用本地正则直接认领,
 * 工具名单原样发,这两道筛选都不会跑。
 */
import { CLARIFICATION_TOOL_NAME } from "../../clarification";
import { inferCurrentActionIntent } from "../../../policy/actionPolicy";
import type { Artifact, ToolResult } from "../../../protocol/results";
import type { PipelineStagePlan } from "../../pipeline/stagePlan";
import type {
  WorkflowDecisionContext,
  WorkflowDescriptor,
  WorkflowCompletionAdapter,
  WorkflowLocalMatch,
  WorkflowRuntime,
  WorkflowToolRecord,
} from "../../workflow/types";
import { DEVUNI_COMMANDS } from "./devuniCommands";

export const DEVUNI_PROJECT_WORKFLOW_ID = "devuni_project";
const DEVUNI_CREATE_PROJECT_TOOL_NAME = "devuni_create_project";

/**
 * 这一轮发给模型的工具:命令表里所有 devuni 工具,外加反问工具。
 *
 * 反问工具必须在内,否则工程名或父目录缺失时,模型连"你工程叫什么"都问不出来。
 * 名单跟着命令表自动长,加接口不用改这里。
 */
export const DEVUNI_PROJECT_TOOL_NAMES: readonly string[] = [
  ...DEVUNI_COMMANDS.map((command) => command.toolName),
  CLARIFICATION_TOOL_NAME,
];

/**
 * 认领规则:当前动作是工程生命周期操作,且文本含工程名词。
 *
 * “刚刚新建的工程”这类词只是目标上下文,不能抢走后面的“写入文件”
 * “列出文件”或“运行命令”。动作意图由路由层预先计算,直接调用 matcher
 * 时则在这里回退计算,确保两条入口行为一致。
 *
 * "建"必须紧跟着"个 / 一个 / 工程 / 项目"才算动作,否则"建议""组建"这类词
 * 会被误当成建工程。
 */
const DEVUNI_PROJECT_ACTION =
  /(?:新建|创建|建立|搭建|生成|打开|开启|关闭|关掉|关了|删除|删掉|移除|重命名|改名|改个名|建(?=个|一个|工程|项目))/u;
const DEVUNI_CREATE_PROJECT_ACTION =
  /(?:新建|创建|建立|搭建|生成|建(?=个|一个|工程|项目))/u;
const HISTORICAL_CREATED_PROJECT_REFERENCE =
  /(?:(?:刚刚?|之前|此前|上(?:一)?轮|我|你|系统)[^，。；,;]{0,8})?(?:新建|创建|建立|搭建|生成)(?:好|完成)?的(?=工程|项目)/gu;
const DEVUNI_PROJECT_NOUN = /(?:工程|项目)/u;
/**
 * 一旦出现这几个词,说明这趟活是写代码、不是管工程,应当让给代码交付那条线。
 * 单独的 "ST" 不算——"新建一个 ST 工程"仍然是工程事务。
 */
const CODE_DELIVERY_MARKER = /(?:程序|代码|源码|结构化文本|IEC\s*61131)/u;

const NO_MATCH_REASON = "本地规则未识别为 devuni 工程事务请求";
const MATCH_REASON = "本地规则识别为 devuni 工程事务请求";

function completedClarification(result: ToolResult): boolean {
  if (!result.ok || !result.data || typeof result.data !== "object") return false;
  const data = result.data as Record<string, unknown>;
  return data.cancelled !== true;
}

function requestsProjectCreation(userText: string): boolean {
  const currentActionText = userText.replace(HISTORICAL_CREATED_PROJECT_REFERENCE, "");
  return DEVUNI_CREATE_PROJECT_ACTION.test(currentActionText);
}

export const DEVUNI_PROJECT_PIPELINE_PLAN: PipelineStagePlan = {
  id: DEVUNI_PROJECT_WORKFLOW_ID,
  resultTransitions: [
    {
      fromToolName: CLARIFICATION_TOOL_NAME,
      toToolName: DEVUNI_CREATE_PROJECT_TOOL_NAME,
      reason: "工程配置已由用户确认，下一轮必须实际调用 devuni_create_project",
      canTransition: completedClarification,
    },
  ],
};

function createdWorkspaceFile(record: WorkflowToolRecord): string | undefined {
  if (record.name !== DEVUNI_CREATE_PROJECT_TOOL_NAME || !record.result.ok) {
    return undefined;
  }
  const data = record.result.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const workspaceFile = (data as Record<string, unknown>).workspaceFile;
  return typeof workspaceFile === "string" && workspaceFile.trim()
    ? workspaceFile.trim()
    : undefined;
}

function createdProjectArtifact(record: WorkflowToolRecord): Artifact | undefined {
  const workspaceFile = createdWorkspaceFile(record);
  return workspaceFile
    ? {
        kind: "file",
        name: "devUni 工程工作区",
        uri: workspaceFile,
      }
    : undefined;
}

function localMatch(context: WorkflowDecisionContext): WorkflowLocalMatch {
  const text = context.userText.trim();
  if (!text || CODE_DELIVERY_MARKER.test(text)) {
    return { matched: false, confidence: 0, reason: NO_MATCH_REASON };
  }
  const actionIntent = context.actionIntent ?? inferCurrentActionIntent(text);
  if (actionIntent !== "project") {
    return {
      matched: false,
      confidence: 0,
      reason: "当前动作属于文件或命令操作,工程名只是目标上下文",
    };
  }
  const matched =
    DEVUNI_PROJECT_ACTION.test(text) && DEVUNI_PROJECT_NOUN.test(text);
  if (!matched) {
    return { matched: false, confidence: 0, reason: NO_MATCH_REASON };
  }
  return { matched: true, confidence: 0.9, reason: MATCH_REASON };
}

export class DevuniProjectWorkflow implements WorkflowRuntime {
  readonly id = DEVUNI_PROJECT_WORKFLOW_ID;
  readonly title = DEVUNI_PROJECT_WORKFLOW.title;
  readonly businessToolNames = DEVUNI_PROJECT_TOOL_NAMES;
  readonly parallelToolCalls = true;
  readonly requiredActionTool?: string;
  readonly pipelinePlan?: PipelineStagePlan;
  readonly completionAdapter?: WorkflowCompletionAdapter;

  constructor(userText = "") {
    const creationRequested = !userText.trim() || requestsProjectCreation(userText);
    if (!creationRequested) return;
    this.requiredActionTool = DEVUNI_CREATE_PROJECT_TOOL_NAME;
    this.pipelinePlan = DEVUNI_PROJECT_PIPELINE_PLAN;
    this.completionAdapter = {
      collectArtifacts: (records) => records
        .map(createdProjectArtifact)
        .filter((artifact): artifact is Artifact => artifact !== undefined),
      collectActionArtifact: createdProjectArtifact,
      finalMessage: (records) => {
        const workspaceFile = records.map(createdWorkspaceFile).filter(Boolean).at(-1);
        return workspaceFile
          ? `工程已成功创建：${workspaceFile}\n\n本轮结束后将自动在新窗口打开。`
          : undefined;
      },
    };
  }

  initialTool(): string | undefined {
    return undefined;
  }

  instructions(): string {
    return (
      "\n本请求由 devuni 工程事务工作流接管。当前可用工具列表是唯一可调用工具集合," +
      "不要调用列表之外的工具,也不要用旧流程假设补工具。" +
      "创建工程前,如果工程类型、工程语言、设备型号、父目录或工程名不明确,先用 " +
      CLARIFICATION_TOOL_NAME +
      " 向用户确认,不要臆造路径或直接采用第一个默认值。" +
      "如果有多个缺失参数,一次调用该工具的 steps 依次询问,不要把多个问题塞进同一个 question。" +
      "新建工程的推荐询问顺序是工程类型、工程语言、设备型号、父目录、工程名,共五步;" +
      "设备型号是必填项,必须先用 devuni_project_options 查询候选项并让用户选择,不得默默采用第一个默认型号。" +
      "设备型号、父目录、工程名这三步必须由用户回答,required 保持默认,不要设为 false;" +
      "工程类型和工程语言允许用户不选(不选时运行时会取候选列表的第一个),这两步请把 required 显式设为 false。" +
      "语言、工程类型或设备型号不确定时,先用 devuni_project_options 查询候选项。" +
      "devuni_create_project 是写操作,必须等用户在界面批准后才会真正执行;" +
      "完成后如实报告磁盘上生成的工程文件路径。宿主会在本轮结束后自动打开新窗口," +
      "不要判断窗口此刻是否已经打开,也不要让用户手动打开或询问是否需要打开。"
    );
  }
}

export const DEVUNI_PROJECT_WORKFLOW: WorkflowDescriptor = {
  id: DEVUNI_PROJECT_WORKFLOW_ID,
  title: "devuni 工程事务",
  description:
    "处理 devUni IDE 插件里的工程级事务:新建工程,以及查询可用的设备型号、语言和工程类型。不涉及代码交付。",
  runtimeManaged: true,
  actionIntents: ["project"],
  workflowRoute: DEVUNI_PROJECT_WORKFLOW_ID,
  businessToolNames: DEVUNI_PROJECT_TOOL_NAMES,
  localMatch,
  createRuntime: (_contract, _state, context) =>
    new DevuniProjectWorkflow(context?.userText),
};
