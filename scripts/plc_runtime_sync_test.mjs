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
  const rawConfig = JSON.parse(await fs.readFile(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME), 'utf8'));
  if (
    rawConfig.schemaVersion !== 2 ||
    rawConfig.configuration !== undefined ||
    rawConfig.runtimeOverrides !== undefined ||
    !Array.isArray(rawConfig.tasks) ||
    !Array.isArray(rawConfig.pous) ||
    !Array.isArray(rawConfig.iecSources) ||
    !Array.isArray(rawConfig.libraries) ||
    !Array.isArray(rawConfig.devices) ||
    !Array.isArray(rawConfig.networks) ||
    !Array.isArray(rawConfig.ioMappings)
  ) {
    throw new Error('任务组态弹窗没有写出完整的 v2 顶层结构');
  }
  const config = await readPlcRuntimeConfig(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME));
  const task = config?.tasks[0];
  if (
    config?.schemaVersion !== 2 ||
    task?.name !== 'SlowMonitorTask' ||
    task.periodMs !== 100 ||
    task.instances[0].pou !== 'Pump' ||
    config.pous[0].source !== 'src/Pump.st' ||
    config.iecSources[0]?.source !== 'src/Pump.st' ||
    config.iecSources[0]?.kind !== 'pou' ||
    config.networks.length !== 0 ||
    config.ioMappings.length !== 0 ||
    'runtimeOverrides' in config
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
    const option = request.options.find((item) => item.id === 'create:MainControlTask:20ms');
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
          taskGroup: 'main_control',
          periodMs: 20,
          reason: '这是常规主控制逻辑，后续可继续绑定同类 PROGRAM。',
        },
        {
          taskGroup: 'slow_monitor',
          periodMs: 100,
          reason: '监视逻辑可以使用较慢周期。',
        },
      ];
    },
    clarification: fake.service,
  });
  if (
    !plan ||
    plan.action !== 'create_config' ||
    plan.taskName !== 'MainControlTask' ||
    plan.periodMs !== 20 ||
    suggestionInputs[0]?.userRequest !== '生成 PID 恒压供水控制，压力变化需要及时响应。' ||
    suggestionInputs[0]?.programName !== 'PID_ConstantPressure'
  ) {
    throw new Error('model task suggestions were not used for the new task dialog');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(path.join(suggestionWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME));
  const suggestedTask = config?.tasks[0];
  if (suggestedTask?.name !== 'MainControlTask' || suggestedTask.periodMs !== 20) {
    throw new Error('selected model task suggestion was not persisted');
  }
}

// Explicit cycle only: ask for the task, but keep the requested 5ms on every
// new-task option instead of reintroducing model-suggested periods.
{
  const periodOnlyWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-period-only-test-'),
  );
  let taskRequest;
  const fake = clarification((request) => {
    taskRequest = request;
    const option = request.options.find((item) => item.id === 'create:MainControlTask:5ms');
    if (!option) throw new Error('explicit 5ms request did not produce a 5ms MainControlTask option');
    return option.id;
  });
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: periodOnlyWorkspace,
    source: 'StartStop.st',
    content: 'PROGRAM StartStop\nEND_PROGRAM\n',
    userRequest: '写一个启保停程序，任务周期是5ms',
    taskSuggestionProvider: async () => [
      { taskGroup: 'fast_control', periodMs: 5, reason: '快速控制' },
      { taskGroup: 'main_control', periodMs: 20, reason: '常规控制' },
      { taskGroup: 'slow_monitor', periodMs: 200, reason: '低频监视' },
    ],
    clarification: fake.service,
  });
  if (!plan || plan.periodMs !== 5) {
    throw new Error('explicit task period was not preserved in the selected plan');
  }
  if (
    !taskRequest?.question.includes('5 ms') ||
    taskRequest.question.includes('请选择任务周期或绑定已有任务') ||
    taskRequest.options
      .filter((item) => item.id.startsWith('create:'))
      .some((item) => !item.label.endsWith('5 ms'))
  ) {
    throw new Error('period-only request did not ask only for the task with a fixed 5ms period');
  }
}

// Explicit task only: ask for the period, while keeping the requested task
// name on every new-task option.
{
  const taskOnlyWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-task-only-test-'),
  );
  let periodRequest;
  const fake = clarification((request) => {
    periodRequest = request;
    const option = request.options.find((item) => item.id === 'create:MainControlTask:20ms');
    if (!option) throw new Error('explicit task request did not produce a MainControlTask period option');
    return option.id;
  });
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: taskOnlyWorkspace,
    source: 'StartStop.st',
    content: 'PROGRAM StartStop\nEND_PROGRAM\n',
    userRequest: '写一个启保停程序，绑定到 MainControlTask',
    taskSuggestionProvider: async () => [
      { taskGroup: 'fast_control', periodMs: 5, reason: '快速控制' },
      { taskGroup: 'main_control', periodMs: 20, reason: '常规控制' },
    ],
    clarification: fake.service,
  });
  if (!plan || plan.taskName !== 'MainControlTask' || plan.periodMs !== 20) {
    throw new Error('explicit task name was not preserved while asking for its period');
  }
  if (
    !periodRequest?.question.includes('MainControlTask') ||
    !periodRequest.question.includes('请选择任务周期') ||
    periodRequest.options
      .filter((item) => item.id.startsWith('create:'))
      .some((item) => !item.label.startsWith('创建 MainControlTask'))
  ) {
    throw new Error('task-only request did not ask only for the requested task period');
  }
}

// Both values are explicit: create the task directly without invoking either
// the suggestion model or the clarification UI.
{
  const fullySpecifiedWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-fully-specified-test-'),
  );
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: fullySpecifiedWorkspace,
    source: 'StartStop.st',
    content: 'PROGRAM StartStop\nEND_PROGRAM\n',
    userRequest: '写一个启保停程序，绑定到 MainControlTask，任务周期是5ms',
    taskSuggestionProvider: async () => {
      throw new Error('fully specified task configuration should not call the suggestion model');
    },
    clarification: {
      request: async () => {
        throw new Error('fully specified task configuration should not open clarification');
      },
    },
  });
  if (
    !plan ||
    plan.action !== 'create_config' ||
    plan.taskName !== 'MainControlTask' ||
    plan.periodMs !== 5
  ) {
    throw new Error('fully specified task configuration was not applied directly');
  }
}

{
  const otherWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-sync-bind-test-'));
  await fs.mkdir(path.join(otherWorkspace, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(otherWorkspace, 'src', 'Existing.st'),
    'PROGRAM Existing\nEND_PROGRAM\n',
    'utf8',
  );
  await writePlcRuntimeConfig(path.join(otherWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME), {
    schemaVersion: 2,
    tasks: [{
          name: 'MainTask',
          deviceId: 'plc',
          type: 'cyclic',
          periodMs: 20,
          priority: 1,
          cpuCore: 0,
          instances: [{ name: 'instance_Existing', pou: 'Existing' }],
    }],
    pous: [{ name: 'Existing', pouType: 'program', source: 'src/Existing.st' }],
    devices: [{ id: 'plc', role: 'local', model: 'PLC', points: [], connections: [] }],
    networks: [],
    ioMappings: [],
  });
  const fake = clarification((request) => {
    const bind = request.options.find((item) => item.id === 'bind:MainTask');
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
  const instances = config?.tasks[0].instances ?? [];
  if (
    !instances.some((item) => item.pou === 'NewProgram') ||
    !config?.pous.some((item) => item.name === 'NewProgram' && item.source === 'src/NewProgram.st')
  ) {
    throw new Error('program was not added to the selected existing task');
  }
}

{
  const dependencyWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-dependencies-test-'),
  );
  await fs.mkdir(path.join(dependencyWorkspace, 'pous'), { recursive: true });
  await fs.writeFile(
    path.join(dependencyWorkspace, 'pous', 'MotorControl.st'),
    'FUNCTION_BLOCK MotorControl\nVAR_INPUT Enable : BOOL; END_VAR\nEND_FUNCTION_BLOCK\n',
    'utf8',
  );
  await fs.writeFile(
    path.join(dependencyWorkspace, 'pous', 'ScaleValue.st'),
    'FUNCTION ScaleValue : REAL\nVAR_INPUT Raw : INT; END_VAR\nEND_FUNCTION\n',
    'utf8',
  );
  const fake = clarification(() => 'create:20ms');
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: dependencyWorkspace,
    source: 'Main.st',
    content: [
      'PROGRAM Main',
      'VAR controller : MotorControl; END_VAR',
      'controller();',
      'END_PROGRAM',
      '',
    ].join('\n'),
    clarification: fake.service,
  });
  if (!plan || plan.action !== 'create_config') {
    throw new Error('PROGRAM with separate POU files did not create a task plan');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(
    path.join(dependencyWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME),
  );
  const pous = new Map((config?.pous ?? []).map((pou) => [pou.name, pou]));
  if (
    pous.get('Main')?.pouType !== 'program' ||
    pous.get('MotorControl')?.pouType !== 'functionBlock' ||
    pous.get('MotorControl')?.source !== 'pous/MotorControl.st' ||
    pous.get('ScaleValue')?.pouType !== 'function' ||
    config?.iecSources.length !== 3 ||
    !config.iecSources.some((item) => item.source === 'pous/MotorControl.st' && item.kind === 'pou') ||
    config?.tasks[0].instances.length !== 1 ||
    config.tasks[0].instances[0].pou !== 'Main'
  ) {
    throw new Error(`separate POU files were not fully indexed: ${JSON.stringify(config)}`);
  }
}

{
  const dataTypeWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-datatype-test-'),
  );
  let clarificationCalled = false;
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: dataTypeWorkspace,
    source: 'types.st',
    content: [
      'TYPE PumpState :',
      '(',
      '  Idle,',
      '  Running',
      ');',
      'END_TYPE',
      '',
    ].join('\n'),
    clarification: {
      request: async () => {
        clarificationCalled = true;
        return { requestId: 'unexpected', cancelled: true };
      },
    },
  });
  if (!plan || plan.action !== 'sync_pous' || clarificationCalled) {
    throw new Error('datatype-only source should update IEC source index without task dialog');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(
    path.join(dataTypeWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME),
  );
  if (
    config?.pous.length !== 0 ||
    config?.iecSources.length !== 1 ||
    config.iecSources[0].source !== 'types.st' ||
    config.iecSources[0].kind !== 'dataType' ||
    config.libraries.length !== 0
  ) {
    throw new Error(`datatype source was not indexed correctly: ${JSON.stringify(config)}`);
  }
}

{
  const libraryWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-library-test-'),
  );
  let clarificationCalled = false;
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: libraryWorkspace,
    source: 'ControlLibrary.st',
    content: [
      'FUNCTION_BLOCK ValveControl',
      'END_FUNCTION_BLOCK',
      'FUNCTION ClampValue : REAL',
      'END_FUNCTION',
      '',
    ].join('\n'),
    clarification: {
      request: async () => {
        clarificationCalled = true;
        return { requestId: 'unexpected', cancelled: true };
      },
    },
  });
  if (!plan || plan.action !== 'sync_pous' || clarificationCalled) {
    throw new Error('FB/FUNCTION-only source should update POU index without task dialog');
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(
    path.join(libraryWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME),
  );
  if (
    config?.tasks.length !== 0 ||
    config.devices.length !== 0 ||
    config.pous.length !== 2 ||
    !config.pous.some((pou) => pou.name === 'ValveControl' && pou.pouType === 'functionBlock') ||
    !config.pous.some((pou) => pou.name === 'ClampValue' && pou.pouType === 'function')
  ) {
    throw new Error('FB/FUNCTION-only source was not persisted as a POU-only v2 config');
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
