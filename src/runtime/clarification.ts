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
      /** 任务组态那一行自由文本:里面可能同时有 task=xxx 和 20ms。 */
      type: 'plcTaskConfiguration';
    };

export interface ClarificationStep {
  id: string;
  title?: string;
  question: string;
  details?: string;
  options?: readonly ClarificationOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  inputValidation?: ClarificationInputValidation;
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
  required?: boolean;
  metadata?: Record<string, unknown>;
  /** 多步骤澄清；省略时保持原有单步骤行为。 */
  steps?: readonly ClarificationStep[];
}

export interface ClarificationAnswer {
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
}

export interface ClarificationResponse {
  requestId: string;
  cancelled: boolean;
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
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
  return parts.length ? `用户已回复澄清：${parts.join('，')}` : '用户已回复澄清。';
}
