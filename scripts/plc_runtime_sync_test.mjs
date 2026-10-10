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
    task?.name !== 'PumpTask' ||
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
  const suggestionInputs = [];
  const fake = clarification((request) => {
    const option = request.options.find((item) => item.id === 'create:PressureControlTask:20ms');
    return option ? option.id : 'cancel';
  });
  const suggestionWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-sync-suggest-test-'));
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: suggestionWorkspace,
    source: 'src/PID_ConstantPressure.st',
    content: 'PROGRAM PID_ConstantPressure\nEND_PROGRAM\n',
    userRequest: '生成 PID 恒压供水控制，压力变化需要及时响应。',
    taskSuggestionProvider: async (input) => {
      suggestionInputs.push(input);
      return [
        {
          taskName: 'PressureControlTask',
          periodMs: 20,
          reason: 'PID 调节需要较快的控制周期。',
        },
        {
          taskName: 'PressureMonitorTask',
          periodMs: 100,
          reason: '监控任务可以使用较慢周期。',
        },
      ];
    },
    clarification: fake.service,
  });
  if (
    !plan ||
    plan.action !== 'create_config' ||
    plan.taskName !== 'PressureControlTask' ||
    plan.periodMs !== 20 ||
    suggestionInputs[0]?.userRequest !== '生成 PID 恒压供水控制，压力变化需要及时响应。' ||
    suggestionInputs[0]?.programName !== 'PID_ConstantPressure'
  ) {
    throw new Error('model task suggestions were not used for the new task dialog');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(path.join(suggestionWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME));
  const suggestedTask = config?.configuration.resources[0].tasks[0];
  if (suggestedTask?.name !== 'PressureControlTask' || suggestedTask.periodMs !== 20) {
    throw new Error('selected model task suggestion was not persisted');
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
  const fake = clarification((request) => {
    const bind = request.options.find((item) => item.id === 'bind:resource_MainTask:MainTask');
    if (!bind || bind.label !== '绑定到 MainTask (20 ms)') {
      throw new Error('existing task option did not preserve its current period');
    }
    return bind.id;
  });
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
