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
export type DeliveryEvidence = z.infer<typeof deliveryEvidenceSchema>;

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
