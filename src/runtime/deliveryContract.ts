import { z } from 'zod';

export const deliveryArtifactKindSchema = z.enum([
  'code',
  'file',
  'report',
  'data',
  'project',
  'text',
  'unknown',
]);

export const deliveryEvidenceSchema = z.enum([
  'final_artifact',
  'successful_tool',
  'successful_write',
  'successful_export',
]);

export const workspacePersistenceSchema = z.enum([
  'required',
  'not_required',
  'optional',
]);

export const deliveryContractDecisionSchema = z.object({
  requiresDeliverable: z.boolean(),
  reason: z.string(),
  deliverables: z.array(z.object({
    kind: deliveryArtifactKindSchema,
    title: z.string(),
    description: z.string(),
    required: z.boolean(),
    acceptableEvidence: z.array(deliveryEvidenceSchema).min(1),
    workspacePersistence: workspacePersistenceSchema.optional(),
    workspaceFileExtension: z.string().regex(/^\.[A-Za-z0-9][A-Za-z0-9._-]*$/).optional(),
    requiredVerificationTools: z.array(z.string().min(1)).max(8).optional(),
  }).strict()).max(8),
}).strict();

export const deliveryContractSchema = deliveryContractDecisionSchema.extend({
  schemaVersion: z.literal(1),
}).strict();

export type DeliveryContract = z.infer<typeof deliveryContractSchema>;
export type DeliveryContractDecision = z.infer<typeof deliveryContractDecisionSchema>;

function compact(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

type DeliveryItem = DeliveryContractDecision['deliverables'][number];

function normalizeDeliverable(item: DeliveryItem) {
  // Generated code is persisted by default. The classifier can explicitly set
  // not_required when the user asks to only display the code.
  const workspacePersistence =
    item.workspacePersistence ??
    (item.kind === 'code' ? 'required' : 'optional');
  const acceptableEvidence = new Set(item.acceptableEvidence);
  if (workspacePersistence === 'required') {
    acceptableEvidence.add('successful_write');
  }
  const extension = item.workspaceFileExtension?.trim();
  const requiredVerificationTools = new Set(item.requiredVerificationTools ?? []);
  if (item.kind === 'code' && extension?.toLowerCase() === '.st') {
    requiredVerificationTools.add('validate_st_code');
  }
  return {
    ...item,
    title: compact(item.title, 120) || '交付物',
    description: compact(item.description, 600) || compact(item.title, 120) || '用户要求的交付内容',
    acceptableEvidence: [...acceptableEvidence],
    workspacePersistence,
    ...(extension ? { workspaceFileExtension: extension } : {}),
    ...(requiredVerificationTools.size
      ? { requiredVerificationTools: [...requiredVerificationTools] }
      : {}),
  };
}

export function createDeliveryContract(value: unknown): DeliveryContract | undefined {
  const decision = deliveryContractDecisionSchema.parse(value);
  if (!decision.requiresDeliverable) {
    return deliveryContractSchema.parse({
      schemaVersion: 1,
      requiresDeliverable: false,
      reason: compact(decision.reason, 500),
      deliverables: [],
    });
  }
  const deliverables = decision.deliverables
    .filter((item) => item.required)
    .map(normalizeDeliverable);
  if (!deliverables.length) {
    return deliveryContractSchema.parse({
      schemaVersion: 1,
      requiresDeliverable: false,
      reason: compact(decision.reason || '未识别到必需交付物', 500),
      deliverables: [],
    });
  }
  return deliveryContractSchema.parse({
    schemaVersion: 1,
    requiresDeliverable: true,
    reason: compact(decision.reason, 500),
    deliverables,
  });
}

export function parseDeliveryContract(value: unknown): DeliveryContract {
  const contract = deliveryContractSchema.parse(value);
  if (!contract.requiresDeliverable) return contract;
  return deliveryContractSchema.parse({
    ...contract,
    deliverables: contract.deliverables.map(normalizeDeliverable),
  });
}

export function createStCodeDeliveryContract(options: {
  reason?: string;
  workspacePersistence?: 'required' | 'not_required' | 'optional';
} = {}): DeliveryContract {
  const workspacePersistence = options.workspacePersistence ?? 'required';
  return createDeliveryContract({
    requiresDeliverable: true,
    reason: options.reason ?? (
      workspacePersistence === 'required'
        ? '用户要求生成 ST 代码，运行时按固定流水线校验并保存到当前工作区'
        : '用户要求生成 ST 代码但不强制保存文件'
    ),
    deliverables: [{
      kind: 'code',
      title: 'ST 程序',
      description: '完整 IEC 61131-3 ST 控制程序源码',
      required: true,
      acceptableEvidence: workspacePersistence === 'required'
        ? ['successful_write']
        : ['final_artifact'],
      workspacePersistence,
      workspaceFileExtension: '.st',
      requiredVerificationTools: ['validate_st_code'],
    }],
  })!;
}

export function inferDeliveryContractFromUserText(userText: string): DeliveryContract | undefined {
  const text = userText.trim();
  if (!isStCodeGenerationRequest(text)) return undefined;
  const workspacePersistence = wantsInlineOnly(text) ? 'not_required' : 'required';
  return createStCodeDeliveryContract({
    reason: workspacePersistence === 'required'
      ? '用户要求生成 ST 代码，运行时按固定流水线校验并保存到当前工作区'
      : '用户要求生成 ST 代码但不强制保存文件',
    workspacePersistence,
  });
}

export function isStCodeDeliveryContract(contract?: DeliveryContract): boolean {
  return contract?.requiresDeliverable === true &&
    contract.deliverables.some((deliverable) =>
      deliverable.required &&
      deliverable.workspaceFileExtension?.toLowerCase() === '.st' &&
      deliverable.requiredVerificationTools?.includes('validate_st_code'),
    );
}

export function isStWorkspaceDeliveryContract(contract?: DeliveryContract): boolean {
  return isStCodeDeliveryContract(contract) &&
    contract?.deliverables.some((deliverable) =>
      deliverable.required &&
      deliverable.workspacePersistence === 'required' &&
      deliverable.workspaceFileExtension?.toLowerCase() === '.st',
    ) === true;
}

function isStCodeGenerationRequest(text: string): boolean {
  if (!text) return false;
  const asksToProduce =
    /(?:生成|设计|编写|写(?:一段|一个|一份)?|实现|创建|输出|给出|保存|落地|generate|create|write|implement|design)/iu.test(text);
  if (!asksToProduce) return false;
  const mentionsCode = /(?:代码|源码|程序|控制程序|控制逻辑|program|code|source)/iu.test(text);
  if (!mentionsCode) return false;
  const mentionsSt =
    /(?:\bST\b|ST\s*语言|结构化文本|Structured\s*Text|IEC\s*61131)/iu.test(text);
  const mentionsPlcProgram =
    /(?:PLC|可编程控制器|水泵|电机|阀门|液位|泵站)[\s\S]{0,120}(?:程序|代码|控制逻辑|控制程序)/iu.test(text) ||
    /(?:程序|代码|控制逻辑|控制程序)[\s\S]{0,120}(?:PLC|可编程控制器)/iu.test(text);
  return mentionsSt || mentionsPlcProgram;
}

function wantsInlineOnly(text: string): boolean {
  return /(?:不要|不用|无需|不需要|别|勿)[^。！？\r\n]{0,16}(?:保存|写入|写文件|落盘)|(?:只|仅)[^。！？\r\n]{0,10}(?:展示|显示|贴出|输出|看代码)/u.test(text);
}

export function renderDeliveryContract(contract: DeliveryContract): string {
  if (!contract.requiresDeliverable || !contract.deliverables.length) {
    return '本轮没有强制交付物契约。';
  }
  return [
    `交付契约: ${contract.reason || '用户要求可交付结果'}`,
    ...contract.deliverables.map((item, index) =>
      `${index + 1}. ${item.title} (${item.kind}): ${item.description}; 可接受证据: ${item.acceptableEvidence.join(', ')}; 工作区落盘: ${item.workspacePersistence ?? 'optional'}${item.workspaceFileExtension ? ` (${item.workspaceFileExtension})` : ''}${item.requiredVerificationTools?.length ? `; 必须验证: ${item.requiredVerificationTools.join(', ')}` : ''}`,
    ),
  ].join('\n');
}
