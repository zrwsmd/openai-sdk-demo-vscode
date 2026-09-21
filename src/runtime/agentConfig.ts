import type {
  ToolPolicy,
  ToolPolicyOverrides,
} from "../tools/toolContract";
import type { ActionPolicy } from "../policy/actionPolicy";
import type { PlcAdapter } from "../plc/plcAdapter";
import type {
  StAnalyzer,
  StAnalyzerToolOptions,
} from "../analysis/stAnalyzer";
import type { AuditEvent } from "../observability/audit";
import type { IndustrialAgentMode } from "../orchestration/agentRoles";
import type {
  AgentApiFormat,
  AgentProvider,
} from "./modelAdapter";
import type {
  AgentDecisionService,
  JevDecisionSettings,
} from "./decision/agentDecision";

export interface AgentConfig {
  /** OpenAI 兼容网关地址(带 /v1),空 = 官方 API */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Provider identity. The first supported provider is OpenAI. */
  provider?: AgentProvider;
  /** Explicit API wire format; omitted/auto preserves the historical route. */
  apiFormat?: AgentApiFormat | "auto";
  /** export_st_program 工具的落盘目录 */
  exportDir: string;
  /** 当前工作区根目录(文件类工具的作用域边界),空 = 未打开工作区 */
  workspaceRoot: string;
  /** Host-authorized workspace roots. Relative paths use workspaceRoot. */
  workspaceRoots?: string[];
  /** Host-owned effect journal. It may return a previously committed result. */
  executeEffect?: <T>(
    toolName: string,
    input: unknown,
    execute: () => Promise<T>,
  ) => Promise<T>;
  /** Policy is host-owned and must be enforced before side effects. */
  policy?: ToolPolicy;
  policyContext?: ToolPolicyOverrides;
  plcAdapter?: PlcAdapter;
  /**
   * ST 校验端口。宿主注入;缺省用内置简易校验,
   * 这样内核脱离宿主(CLI/边缘/单测)仍然可运行。
   */
  stAnalyzer?: StAnalyzer;
  stAnalyzerOptions?: StAnalyzerToolOptions;
  audit?: (event: Omit<AuditEvent, "id" | "timestamp">) => void | Promise<void>;
  orchestration?: IndustrialAgentMode;
  actionPolicy?: ActionPolicy;
  /** Optional semantic decision layer; absent means existing logic only. */
  decisionService?: AgentDecisionService;
  /** Internal Jev settings. The API key is host-injected, never UI-configured. */
  jev?: JevDecisionSettings;
}

export function validateConfig(cfg: AgentConfig): string | null {
  if (!cfg.apiKey)
    return "尚未配置 API Key:点击输入框右下角的 ⚙ 齿轮,在设置面板里填写 Base URL / API Key / Model(配置一次即可)";
  return null;
}
