import {
  GENERATED_MATIEC_CONFIGURATION_PATH,
  PlcRuntimeConfigError,
  createMatiecCompileInputs,
  iecTimeLiteralFromPeriodMs,
  renderMatiecConfiguration,
  runtimeDeploymentFromConfig,
} from './agent.testbundle.mjs';

const config = {
  schemaVersion: 2,
  tasks: [
        {
          name: 'FastTask',
          deviceId: 'plc',
          type: 'cyclic',
          periodMs: 20,
          priority: 0,
          cpuCore: 0,
          instances: [{ name: 'instance_PumpControl', pou: 'PumpControl' }],
        },
        {
          name: 'SlowTask',
          deviceId: 'plc',
          type: 'cyclic',
          periodMs: 1000,
          priority: 2,
          cpuCore: 1,
          instances: [{ name: 'instance_DataLogger', pou: 'DataLogger' }],
        },
  ],
  pous: [
    { name: 'PumpControl', pouType: 'program', source: 'src/PumpControl.st' },
    { name: 'DataLogger', pouType: 'program', source: 'src/DataLogger.st' },
  ],
  devices: [{ id: 'plc', role: 'local', model: 'PLC', points: [], connections: [] }],
  networks: [],
  ioMappings: [],
};

if (iecTimeLiteralFromPeriodMs(20) !== 'T#20ms') {
  throw new Error('integer period was not converted to IEC TIME');
}
if (iecTimeLiteralFromPeriodMs(2.5) !== 'T#2.5ms') {
  throw new Error('decimal period was not converted to IEC TIME');
}

const expectedConfiguration = [
  'CONFIGURATION CONFIG_IEC',
  '  RESOURCE resource_FastTask ON plc',
  '    TASK FastTask(INTERVAL := T#20ms, PRIORITY := 0);',
  '    PROGRAM instance_PumpControl WITH FastTask : PumpControl;',
  '  END_RESOURCE',
  '  RESOURCE resource_SlowTask ON plc',
  '    TASK SlowTask(INTERVAL := T#1000ms, PRIORITY := 2);',
  '    PROGRAM instance_DataLogger WITH SlowTask : DataLogger;',
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
  deployment.resources[1].tasks[0].cpuCore !== 1 ||
  deployment.resources[1].tasks[0].programs[0].source !== 'src/DataLogger.st'
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
eventConfig.tasks[0] = {
  name: 'EventTask',
  deviceId: 'plc',
  type: 'event',
  periodMs: 100,
  priority: 1,
  cpuCore: 0,
  instances: [{ name: 'instance_PumpControl', pou: 'PumpControl' }],
};
let eventRejected = false;
try {
  renderMatiecConfiguration(eventConfig);
} catch (error) {
  eventRejected = error instanceof PlcRuntimeConfigError && /event/.test(error.message);
}
if (!eventRejected) throw new Error('event task should not be rendered as a cyclic matiec task');

const badInstance = structuredClone(config);
badInstance.tasks[0].instances[0].name = 'custom_name';
let badInstanceRejected = false;
try {
  renderMatiecConfiguration(badInstance);
} catch (error) {
  badInstanceRejected = error instanceof PlcRuntimeConfigError && /instance_PumpControl/.test(error.message);
}
if (!badInstanceRejected) throw new Error('devUni-incompatible instance name should be rejected');

console.log('plc matiec adapter tests passed');
