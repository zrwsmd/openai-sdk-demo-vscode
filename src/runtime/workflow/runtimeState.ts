export type DeliveryWorkflowRuntimeState = {
  slots: Map<string, unknown>;
};

export function createDeliveryWorkflowRuntimeState(): DeliveryWorkflowRuntimeState {
  return { slots: new Map<string, unknown>() };
}

export function getWorkflowStateSlot<T>(
  state: DeliveryWorkflowRuntimeState,
  key: string,
  create: () => T,
): T {
  const existing = state.slots.get(key);
  if (existing !== undefined) return existing as T;
  const value = create();
  state.slots.set(key, value);
  return value;
}
