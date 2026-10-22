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

function clarificationWithCustomText(select, customText) {
  const requests = [];
  return {
    requests,
    service: {
      request: async (request) => {
        requests.push(request);
        const choice = select(request);
        const option = request.options.find((item) => item.id === choice);
        return {
          requestId: 'test',
          cancelled: false,
          selectedOptionId: choice,
          customText,
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

// A custom answer is authoritative even when the UI also reports the selected
// recommendation. This mirrors the webview response when the user selects a
// suggested row and fills the custom input in the same clarification card.
{
  const customWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-custom-selection-test-'),
  );
  const fake = clarificationWithCustomText(
    (request) => request.options.find((item) => item.id === 'create:SlowMonitorTask:500ms')?.id,
    'task=test11,8ms',
  );
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: customWorkspace,
    source: 'StartHoldStop.st',
    content: 'PROGRAM PRG_StartHoldStop\nEND_PROGRAM\n',
    taskSuggestionProvider: async () => [{
      taskGroup: 'slow_monitor',
      periodMs: 500,
      reason: '适合低频监视。',
    }],
    clarification: fake.service,
  });
  if (!plan || plan.taskName !== 'test11' || plan.periodMs !== 8) {
    throw new Error(`custom task answer was ignored: ${JSON.stringify(plan)}`);
  }
  await plan.commit();
  const config = await readPlcRuntimeConfig(
    path.join(customWorkspace, PLC_RUNTIME_CONFIG_FILE_NAME),
  );
  const task = config?.tasks[0];
  if (task?.name !== 'test11' || task.periodMs !== 8) {
    throw new Error('custom task name/period did not persist over recommendation');
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

// 表单模式：只填还缺的字段，返回结构化值，不再解析一行自由文本。
function clarificationWithFields(select) {
  const requests = [];
  return {
    requests,
    service: {
      request: async (request) => {
        requests.push(request);
        const fields = select(request) ?? {};
        return { requestId: 'test', cancelled: false, fields };
      },
    },
  };
}

// Explicit cycle only: ask for the task, but keep the requested 5ms on every
// new-task option instead of reintroducing model-suggested periods.
{
  const periodOnlyWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-period-only-test-'),
  );
  let taskRequest;
  const fake = clarificationWithFields(() => ({ taskName: 'MainControlTask' }));
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
  taskRequest = fake.requests[0];
  if (!plan || plan.periodMs !== 5 || plan.taskName !== 'MainControlTask') {
    throw new Error('explicit task period was not preserved when only the task name was asked');
  }
  const periodField = taskRequest?.inputFields?.find((field) => field.key === 'periodMs');
  const nameField = taskRequest?.inputFields?.find((field) => field.key === 'taskName');
  if (
    !periodField?.readonly ||
    periodField.value !== 5 ||
    nameField?.readonly ||
    !nameField?.choices?.includes('MainControlTask') ||
    taskRequest.options.length !== 0 ||
    taskRequest.question !== '请补充任务名。'
  ) {
    throw new Error('period-only request did not render a single task-name field');
  }
}

// Explicit task only: ask for the period, while keeping the requested task
// name on the read-only confirmed tag.
{
  const taskOnlyWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-task-only-test-'),
  );
  let periodRequest;
  const fake = clarificationWithFields(() => ({ periodMs: 20 }));
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
  periodRequest = fake.requests[0];
  if (!plan || plan.taskName !== 'MainControlTask' || plan.periodMs !== 20) {
    throw new Error('explicit task name was not preserved while asking for its period');
  }
  const nameField = periodRequest?.inputFields?.find((field) => field.key === 'taskName');
  const periodField = periodRequest?.inputFields?.find((field) => field.key === 'periodMs');
  if (
    !nameField?.readonly ||
    nameField.value !== 'MainControlTask' ||
    periodField?.readonly ||
    !periodField?.choices?.includes(20) ||
    periodRequest.options.length !== 0 ||
    periodRequest.question !== '请补充任务周期。'
  ) {
    throw new Error('task-only request did not render a single period field');
  }
}

// 两样都没说：上面仍然是整条方案卡，下面两个字段都要填。
// 点卡片等于把值填进框里，所以提交时带的是 fields，不是 selectedOptionId。
{
  const bothWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-both-fields-test-'),
  );
  const fake = clarificationWithFields(() => ({
    taskName: 'MainControlTask',
    periodMs: 50,
  }));
  const plan = await preparePlcRuntimeConfigSync({
    workspaceRoot: bothWorkspace,
    source: 'StartStop.st',
    content: 'PROGRAM StartStop\nEND_PROGRAM\n',
    userRequest: '写一个启保停程序',
    taskSuggestionProvider: async () => [
      { taskGroup: 'main_control', periodMs: 20, reason: '常规控制' },
    ],
    clarification: fake.service,
  });
  const request = fake.requests[0];
  const editable = request?.inputFields?.filter((field) => !field.readonly) ?? [];
  if (
    !plan ||
    plan.taskName !== 'MainControlTask' ||
    plan.periodMs !== 50 ||
    editable.length !== 2 ||
    request.options.length === 0
  ) {
    throw new Error('two-field request did not keep the full-scheme cards plus two fields');
  }
}

// 表单值里的周期非法时后端要拒绝，不能只靠前端拦。
{
  const invalidWorkspace = await fs.mkdtemp(
    path.join(os.tmpdir(), 'plc-runtime-sync-invalid-field-test-'),
  );
  const fake = clarificationWithFields(() => ({ taskName: 'yy', periodMs: 0 }));
  let failed = false;
  try {
    await preparePlcRuntimeConfigSync({
      workspaceRoot: invalidWorkspace,
      source: 'StartStop.st',
      content: 'PROGRAM StartStop\nEND_PROGRAM\n',
      userRequest: '写一个启保停程序',
      taskSuggestionProvider: async () => [
        { taskGroup: 'main_control', periodMs: 20, reason: '常规控制' },
      ],
      clarification: fake.service,
    });
  } catch (error) {
    failed = /任务周期必须在/.test(String(error?.message ?? error));
  }
  if (!failed) throw new Error('out-of-range period from the form was not rejected');
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

// 任务组态自定义输入必须按规则校验：任务名是 IEC 标识符（含关键字黑名单），
// 周期是 1~60000 的整数毫秒。旧实现里非法输入会静默回落到候选值，
// 用户以为填的生效了，实际用的是默认任务名和默认周期。
{
  const rejected = [
    { text: 'task=1abc, 20ms', expect: '任务名不合法' },
    { text: 'task=TASK, 20ms', expect: '任务名不合法' },
    { text: 'task=my-task, 20ms', expect: '任务名不合法' },
    { text: 'task=has space, 20ms', expect: '任务名不合法' },
    { text: '20.5ms', expect: '整数毫秒' },
    { text: '0ms', expect: '1~60000' },
    { text: '99999ms', expect: '1~60000' },
  ];
  for (const item of rejected) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-task-validation-'));
    const fake = clarificationWithCustomText(
      (request) => request.options.find((option) => option.id.startsWith('create:'))?.id,
      item.text,
    );
    let message = '';
    try {
      await preparePlcRuntimeConfigSync({
        workspaceRoot: dir,
        source: 'Pump.st',
        content: 'PROGRAM Pump\nEND_PROGRAM\n',
        taskSuggestionProvider: async () => [
          { taskGroup: 'main_control', periodMs: 20, reason: '常规控制。' },
        ],
        clarification: fake.service,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    if (!message.includes(item.expect)) {
      throw new Error(
        `任务组态自定义输入「${item.text}」没有按规则拒绝: ${message || '未报错'}`,
      );
    }
  }

  // 正例：秒单位换算后仍是整数毫秒；裸数字按毫秒处理；下划线开头合法。
  const accepted = [
    { text: 'task=MainTask, 0.5s', taskName: 'MainTask', periodMs: 500 },
    { text: 'task=_aux, 20', taskName: '_aux', periodMs: 20 },
  ];
  for (const item of accepted) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-task-validation-ok-'));
    const fake = clarificationWithCustomText(
      (request) => request.options.find((option) => option.id.startsWith('create:'))?.id,
      item.text,
    );
    const plan = await preparePlcRuntimeConfigSync({
      workspaceRoot: dir,
      source: 'Pump.st',
      content: 'PROGRAM Pump\nEND_PROGRAM\n',
      taskSuggestionProvider: async () => [
        { taskGroup: 'main_control', periodMs: 20, reason: '常规控制。' },
      ],
      clarification: fake.service,
    });
    if (!plan || plan.taskName !== item.taskName || plan.periodMs !== item.periodMs) {
      throw new Error(
        `任务组态自定义输入「${item.text}」解析错误: ${JSON.stringify(plan)}`,
      );
    }
  }
}

console.log('plc runtime sync tests passed');
