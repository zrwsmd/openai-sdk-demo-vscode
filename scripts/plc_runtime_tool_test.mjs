import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ToolRegistry,
  createCoreToolProvider,
  createStToolProvider,
} from './agent.testbundle.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-tool-test-'));
await fs.writeFile(path.join(workspace, 'Pump.st'), 'PROGRAM Pump\nEND_PROGRAM\n', 'utf8');

const registry = new ToolRegistry([
  createCoreToolProvider(),
  createStToolProvider(),
]);
const tools = registry.createTools({
  cfg: {
    apiKey: 'test',
    model: 'test',
    workspaceRoot: workspace,
    workspaceRoots: [workspace],
  },
});
const tool = tools.find((candidate) => candidate.name === 'audit_plc_runtime_config');
if (!tool) throw new Error('audit_plc_runtime_config tool was not registered');

const raw = await tool.invoke({}, '{}', {});
const result = JSON.parse(raw);
if (
  result.ok !== true ||
  result.risk !== 'read' ||
  result.effect !== 'none' ||
  result.data?.configState !== 'missing' ||
  result.data?.summary?.programCount !== 1 ||
  result.data?.issues?.[0]?.code !== 'config_missing'
) {
  throw new Error(`unexpected audit_plc_runtime_config result: ${raw}`);
}

console.log('plc runtime tool tests passed');
