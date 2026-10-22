export const CLARIFICATION_TOOL_NAME = 'request_clarification';

export type ClarificationKind =
  | 'general'
  | 'plc_task_configuration'
  | (string & {});

export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
  value?: unknown;
  /**
   * 这个选项对应哪些字段值。给了之后弹窗可以把它当成"一键填表"：
   * 点一下就把值写进下面的输入框，用户还能接着改，不用在"选选项"和
   * "自己填"之间二选一（那个二选一以前要靠优先级规则猜，出过 bug）。
   */
  fields?: Readonly<Record<string, string | number>>;
}

/**
 * 弹窗里的一个输入框。字段清单由后端按"用户还缺什么"生成：
 * 缺两个就两个都渲染，缺一个就只渲染那一个，另一个用 readonly 显示已确认的值。
 */
export interface ClarificationInputField {
  key: string;
  label: string;
  type:
    | 'iecIdentifier'
    | 'positiveInteger'
    | 'projectName'
    | 'directoryPath';
  /** 已确认的字段：弹窗只在标题栏显示它，不给编辑。 */
  readonly?: boolean;
  /** readonly 为 true 时的已确认值。 */
  value?: string | number;
  /** 可编辑字段的预填值。 */
  initialValue?: string | number;
  placeholder?: string;
  /** 输入框下方常驻的灰色规则说明。 */
  hint?: string;
  /** 单字段模式下的快捷取值，渲染成一排按钮，点一下填进输入框。 */
  choices?: readonly (string | number)[];
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * 自定义输入的校验规则。只允许枚举类型，不让调用方传正则：
 * 规则要在前端和后端保持一致，正则字符串在 JSON 里转义一次就走样了。
 */
export type ClarificationInputValidation =
  | {
      type: 'iecIdentifier';
      label?: string;
    }
  | {
      type: 'positiveInteger';
      label?: string;
      min?: number;
      max?: number;
      unit?: string;
    }
  | {
      /** 工程名：会被当成目录名用，按 Windows 建目录的规则卡。 */
      type: 'projectName';
      label?: string;
    }
  | {
      /** 工程父目录：只校验格式（绝对路径、非法字符），存在性由调用方判断。 */
      type: 'directoryPath';
      label?: string;
    }
  | {
      /** 任务组态那一行自由文本:里面可能同时有 task=xxx 和 20ms。 */
      type: 'plcTaskConfiguration';
    };

const PROJECT_NAME_HINT = /工程名|项目名|(?:工程|项目).{0,6}名|project\s*name|prj\s*name/iu;
const DIRECTORY_PATH_HINT = /父目录|目录|路径|文件夹|directory|folder|parent\s*dir|\bpath\b/iu;

function validationFromFieldId(
  fieldId: string | undefined,
): ClarificationInputValidation | undefined {
  const id = String(fieldId ?? '').trim();
  if (!id) return undefined;
  if (/工程名|项目名/u.test(id)) return { type: 'projectName', label: '工程名' };
  if (/父目录|目录|路径/u.test(id)) return { type: 'directoryPath', label: '目录' };
  const normalized = id.replace(/[^a-z0-9]/giu, '').toLowerCase();
  if (!normalized) return undefined;
  if (normalized.endsWith('projectname') || normalized.endsWith('prjname')) {
    return { type: 'projectName', label: '工程名' };
  }
  if (/path|directory|folder|dir/u.test(normalized)) {
    return { type: 'directoryPath', label: '目录' };
  }
  return undefined;
}

/**
 * 模型经常忘记给自定义输入写 validation，而工程名、目录这类字段不校验的话
 * 用户填什么都能提交，错误要到建目录那一刻才炸。这里按字段 id 补一层默认规则：
 * 模型自己写了就用它的，没写才补。
 * 只补这两类——它们有客观格式，猜错了最多多提示一句；别的类型猜错会误拦。
 */
export function inferClarificationValidation(
  fieldId: string | undefined,
  question?: string,
): ClarificationInputValidation | undefined {
  const fromId = validationFromFieldId(fieldId);
  if (fromId) return fromId;
  const text = String(question ?? '');
  const mentionsName = PROJECT_NAME_HINT.test(text);
  const mentionsPath = DIRECTORY_PATH_HINT.test(text);
  // 一句话里两样都提了，说明这一步要同时问两件事，猜哪条都不对，宁可不补。
  if (mentionsName === mentionsPath) return undefined;
  return mentionsName
    ? { type: 'projectName', label: '工程名' }
    : { type: 'directoryPath', label: '目录' };
}

export interface ClarificationStep {
  id: string;
  title?: string;
  question: string;
  details?: string;
  options?: readonly ClarificationOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  inputValidation?: ClarificationInputValidation;
  /** 结构化输入框；给了之后弹窗渲染表单，不再用 inputValidation 那一行自由文本。 */
  inputFields?: readonly ClarificationInputField[];
  required?: boolean;
}

export interface ClarificationRequest {
  requestId?: string;
  kind?: ClarificationKind;
  title: string;
  question: string;
  details?: string;
  options?: readonly ClarificationOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  inputValidation?: ClarificationInputValidation;
  inputFields?: readonly ClarificationInputField[];
  required?: boolean;
  metadata?: Record<string, unknown>;
  /** 多步骤澄清；省略时保持原有单步骤行为。 */
  steps?: readonly ClarificationStep[];
}

export interface ClarificationAnswer {
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
  fields?: Readonly<Record<string, string | number>>;
}

export interface ClarificationResponse {
  requestId: string;
  cancelled: boolean;
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
  /** 表单模式下用户填的值，key 是字段 key。 */
  fields?: Readonly<Record<string, string | number>>;
  /** 多步骤澄清的答案，key 是步骤 id。 */
  answers?: Readonly<Record<string, ClarificationAnswer>>;
  sequenceId?: string;
  stepId?: string;
  stepIndex?: number;
  stepCount?: number;
  sequenceCompleted?: boolean;
}

export interface ClarificationService {
  request(
    request: ClarificationRequest,
    signal?: AbortSignal,
  ): Promise<ClarificationResponse>;
}

export function summarizeClarificationResponse(
  response: ClarificationResponse,
): string {
  if (response.cancelled) return '用户取消了澄清。';
  if (response.answers && Object.keys(response.answers).length > 0) {
    return `用户已完成 ${Object.keys(response.answers).length} 项澄清。`;
  }
  const parts: string[] = [];
  if (response.selectedOptionId) parts.push(`选项=${response.selectedOptionId}`);
  if (typeof response.customText === 'string' && response.customText.trim()) {
    parts.push(`自定义=${response.customText.trim()}`);
  }
  if (response.fields && Object.keys(response.fields).length > 0) {
    parts.push(
      Object.entries(response.fields)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('，'),
    );
  }
  return parts.length ? `用户已回复澄清：${parts.join('，')}` : '用户已回复澄清。';
}
