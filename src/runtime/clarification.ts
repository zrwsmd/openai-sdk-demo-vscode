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

export interface ClarificationRequest {
  requestId?: string;
  kind?: ClarificationKind;
  title: string;
  question: string;
  details?: string;
  options?: readonly ClarificationOption[];
  allowCustom?: boolean;
  customPlaceholder?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ClarificationResponse {
  requestId: string;
  cancelled: boolean;
  selectedOptionId?: string;
  customText?: string;
  value?: unknown;
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
  const parts: string[] = [];
  if (response.selectedOptionId) parts.push(`选项=${response.selectedOptionId}`);
  if (typeof response.customText === 'string' && response.customText.trim()) {
    parts.push(`自定义=${response.customText.trim()}`);
  }
  return parts.length ? `用户已回复澄清：${parts.join('，')}` : '用户已回复澄清。';
}
