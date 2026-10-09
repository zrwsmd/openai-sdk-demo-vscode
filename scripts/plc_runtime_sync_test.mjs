import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PLC_RUNTIME_CONFIG_FILE_NAME,
  preparePlcRuntimeConfigSync,
  readPlcRuntimeConfig,
  writePlcRuntimeConfig,
} from './agent.testbundle.mjs';

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-sync-test-'));

function clarification(select) {
  const requests = [];
  return {
    requests,
    service: {
      request: async (request) => {
        requests.push(request);
        const choice = select(request);
        if (choice === 'cancel') {
          return { requestId: 'test', cancelled: true };
        }
        const option = request.options.find((item) => item.id === choice);
        return {
          requestId: 'test',
          cancelled: false,
          selectedOptionId: choice,
          value: option?.value,
        };
      },
    },
  };
}

{
  const fake = clarification(() => 'create:100ms');
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: workspace,
    source: 'src/Pump.st',
    content: 'PROGRAM Pump\nEND_PROGRAM\n',
    clarification: fake.service,
  });
  if (!plan || plan.action !== 'create_config' || plan.periodMs !== 100) {
    throw new Error('missing config did not create a 100ms task plan');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME));
  const task = config?.configuration.resources[0].tasks[0];
  if (
    task?.name !== 'MainTask' ||
    task.periodMs !== 100 ||
    task.programs[0].typeName !== 'Pump' ||
    task.programs[0].source !== 'src/Pump.st'
  ) {
    throw new Error('created plc-runtime.json does not contain expected task binding');
  }
  const bound = await preparePlcRuntimeConfigSync({
    workspaceRoot: workspace,
    source: 'src/Pump.st',
    content: 'PROGRAM Pump\nEND_PROGRAM\n',
    clarification: fake.service,
  });
  if (bound !== undefined || fake.requests.length !== 1) {
    throw new Error('already-bound program should not ask for clarification again');
  }
}

{
  const otherWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-sync-bind-test-'));
  await writePlcRuntimeConfig(path.join(otherWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME), {
    schemaVersion: 1,
    configuration: {
      name: 'CONFIG_IEC',
      resources: [{
        name: 'resource_MainTask',
        target: 'PLC',
        tasks: [{
          name: 'MainTask',
          type: 'cyclic',
          periodMs: 20,
          priority: 1,
          cpuCore: 1,
          programs: [{
            instanceName: 'instance_Existing',
            typeName: 'Existing',
            source: 'src/Existing.st',
          }],
        }],
      }],
    },
  });
  const fake = clarification(() => 'bind:resource_MainTask:MainTask');
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: otherWorkspace,
    source: 'src/NewProgram.st',
    content: 'PROGRAM NewProgram\nEND_PROGRAM\n',
    clarification: fake.service,
  });
  if (!plan || plan.action !== 'bind_program') {
    throw new Error('existing task was not offered as a bind target');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(path.join(otherWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME));
  const programs = config?.configuration.resources[0].tasks[0].programs ?? [];
  if (!programs.some((item) => item.typeName === 'NewProgram' && item.source === 'src/NewProgram.st')) {
    throw new Error('program was not added to the selected existing task');
  }
}

{
  const cancelWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-sync-cancel-test-'));
  const fake = clarification(() => 'cancel');
  let cancelled = false;
  try {
    await preparePlcRuntimeConfigSync({
      workspaceRoot: cancelWorkspace,
      source: 'src/Cancelled.st',
      content: 'PROGRAM Cancelled\nEND_PROGRAM\n',
      clarification: fake.service,
    });
  } catch (error) {
    cancelled = /取消/.test(error instanceof Error ? error.message : String(error));
  }
  if (!cancelled) throw new Error('cancelled clarification did not stop the sync plan');
  const configPath = path.join(cancelWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME);
  if (await fs.stat(configPath).then(() => true, () => false)) {
    throw new Error('cancelled clarification wrote plc-runtime.json');
  }
}

console.log('plc runtime sync tests passed');
