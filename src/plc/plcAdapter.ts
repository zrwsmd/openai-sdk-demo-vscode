export interface PlcVariable {
  name: string;
  address: string;
  type: 'BOOL' | 'INT' | 'REAL' | 'TIME';
  value?: boolean | number | string;
  comment?: string;
}

export interface PlcAdapter {
  readonly id: string;
  getIoTable(signal?: AbortSignal): Promise<PlcVariable[]>;
  readVariables(names: string[], signal?: AbortSignal): Promise<PlcVariable[]>;
}

/** Deterministic adapter for development, replay and offline evaluation. */
export class MockPlcAdapter implements PlcAdapter {
  readonly id = 'mock-plc';
  private readonly variables: PlcVariable[] = [
    { name: 'Start_Btn', address: '%IX0.0', type: 'BOOL', value: false, comment: '启动按钮' },
    { name: 'Stop_Btn', address: '%IX0.1', type: 'BOOL', value: false, comment: '停止按钮' },
    { name: 'Motor_Main', address: '%QX0.0', type: 'BOOL', value: false, comment: '主接触器' },
    { name: 'Motor_Star', address: '%QX0.1', type: 'BOOL', value: false, comment: '星形接触器' },
    { name: 'Motor_Delta', address: '%QX0.2', type: 'BOOL', value: false, comment: '三角形接触器' },
  ];

  async getIoTable(signal?: AbortSignal): Promise<PlcVariable[]> {
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError');
    return this.variables.map((item) => ({ ...item }));
  }

  async readVariables(names: string[], signal?: AbortSignal): Promise<PlcVariable[]> {
    const table = await this.getIoTable(signal);
    const requested = new Set(names);
    return table.filter((item) => requested.has(item.name));
  }
}

