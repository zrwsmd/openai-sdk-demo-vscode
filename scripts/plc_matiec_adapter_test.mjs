import {
  GENERATED_MATIEC_CONFIGURATION_PATH,
  PlcRuntimeConfigError,
  createMatiecCompileInputs,
  iecTimeLiteralFromPeriodMs,
  renderMatiecConfiguration,
  runtimeDeploymentFromConfig,
} from './agent.testbundle.mjs';

const config = {
  schemaVersion: 1,
  configuration: {
    name: 'CONFIG_IEC',
    resources: [{
      name: 'resource_MainTask',
      target: 'PLC',
      tasks: [
        {
          name: 'FastTask',
          type: 'cyclic',
          periodMs: 20,
          priority: 0,
          cpuCore: 0,
          programs: [{
            instanceName: 'instance_Pump',
            typeName: 'PumpControl',
            source: 'src/PumpControl.st',
          }],
        },
        {
          name: 'SlowTask',
          type: 'cyclic',
          periodMs: 1000,
          priority: 2,
          cpuCore: 1,
          programs: [{
            instanceName: 'instance_Log',
            typeName: 'DataLogger',
            source: 'src/DataLogger.st',
            retain: true,
          }],
        },
      ],
    }],
  },
};

if (iecTimeLiteralFromPeriodMs(20) !== 'T#20ms') {
  throw new Error('integer period was not converted to IEC TIME');
}
if (iecTimeLiteralFromPeriodMs(2.5) !== 'T#2.5ms') {
  throw new Error('decimal period was not converted to IEC TIME');
}

const expectedConfiguration = [
  'CONFIGURATION CONFIG_IEC',
  '  RESOURCE resource_MainTask ON PLC',
  '    TASK FastTask(INTERVAL := T#20ms, PRIORITY := 0);',
  '    TASK SlowTask(INTERVAL := T#1000ms, PRIORITY := 2);',
  '    PROGRAM instance_Pump WITH FastTask : PumpControl;',
  '    PROGRAM RETAIN instance_Log WITH SlowTask : DataLogger;',
  '  END_RESOURCE',
  'END_CONFIGURATION',
  '',
].join('\n');

const rendered = renderMatiecConfiguration(config);
if (rendered !== expectedConfiguration) {
  throw new Error(`unexpected matiec CONFIGURATION:\n${rendered}`);
}

const deployment = runtimeDeploymentFromConfig(config);
if (
  deployment.configurationName !== 'CONFIG_IEC' ||
  deployment.resources[0].tasks[1].cpuCore !== 1 ||
  deployment.resources[0].tasks[1].programs[0].retain !== true
) {
  throw new Error('runtime deployment summary lost scheduling metadata');
}

const sourceFiles = [{ path: 'src\\PumpControl.st', content: 'PROGRAM PumpControl\nEND_PROGRAM\n' }];
const compileInputs = createMatiecCompileInputs(config, sourceFiles);
if (
  compileInputs.length !== 2 ||
  compileInputs[0].path !== 'src/PumpControl.st' ||
  compileInputs[0].role !== 'source' ||
  compileInputs[1].path !== GENERATED_MATIEC_CONFIGURATION_PATH ||
  compileInputs[1].role !== 'configuration' ||
  compileInputs[1].content !== expectedConfiguration
) {
  throw new Error('compile inputs were not built as source files plus generated configuration');
}
if (sourceFiles[0].path !== 'src\\PumpControl.st') {
  throw new Error('compile input builder mutated caller source files');
}

const eventConfig = structuredClone(config);
eventConfig.configuration.resources[0].tasks[0] = {
  name: 'EventTask',
  type: 'event',
  priority: 1,
  cpuCore: 0,
  trigger: { kind: 'variable', ref: 'StartButton', edge: 'rising' },
  programs: [{
    instanceName: 'instance_Event',
    typeName: 'EventProgram',
    source: 'src/EventProgram.st',
  }],
};
let eventRejected = false;
try {
  renderMatiecConfiguration(eventConfig);
} catch (error) {
  eventRejected = error instanceof PlcRuntimeConfigError && /event/.test(error.message);
}
if (!eventRejected) throw new Error('event task should not be rendered as a cyclic matiec task');

const badTarget = structuredClone(config);
badTarget.configuration.resources[0].target = 'PLC 1';
let badTargetRejected = false;
try {
  renderMatiecConfiguration(badTarget);
} catch (error) {
  badTargetRejected = error instanceof PlcRuntimeConfigError && /target/.test(error.message);
}
if (!badTargetRejected) throw new Error('non-IEC resource target should be rejected by matiec adapter');

console.log('plc matiec adapter tests passed');
