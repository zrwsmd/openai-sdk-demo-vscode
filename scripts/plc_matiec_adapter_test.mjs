import {
  GENERATED_MATIEC_CONFIGURATION_PATH,
  PlcRuntimeConfigError,
  createAccuPlcLibraryConfig,
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
  iecSources: [
    { source: 'src/PumpControl.st', kind: 'pou' },
    { source: 'src/DataLogger.st', kind: 'pou' },
  ],
  libraries: ['Motion'],
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

const sourceFiles = [
  { path: 'src\\PumpControl.st', content: 'PROGRAM PumpControl\nEND_PROGRAM\n' },
  { path: 'src/DataLogger.st', content: 'PROGRAM DataLogger\nEND_PROGRAM\n' },
];
const compileInputs = createMatiecCompileInputs(config, sourceFiles);
if (
  compileInputs.length !== 3 ||
  compileInputs[0].path !== 'PumpControl.st' ||
  compileInputs[0].role !== 'source' ||
  compileInputs[1].path !== 'DataLogger.st' ||
  compileInputs[2].path !== GENERATED_MATIEC_CONFIGURATION_PATH ||
  GENERATED_MATIEC_CONFIGURATION_PATH.includes('/') ||
  compileInputs[2].role !== 'configuration' ||
  compileInputs[2].content !== expectedConfiguration
) {
  throw new Error('compile inputs were not flattened into the compile directory root');
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

const customInstance = structuredClone(config);
customInstance.tasks[0].instances[0].name = 'pump_instance_1';
if (!renderMatiecConfiguration(customInstance).includes('PROGRAM pump_instance_1 WITH FastTask')) {
  throw new Error('valid custom instance name should be preserved');
}

const libraryConfig = createAccuPlcLibraryConfig(config);
if (
  libraryConfig.find((item) => item.name === 'Motion')?.enable !== true ||
  libraryConfig.find((item) => item.name === 'Python')?.enable !== true ||
  libraryConfig.find((item) => item.name === 'SMC_Basic')?.enable !== false
) {
  throw new Error(`library dependencies were not expanded: ${JSON.stringify(libraryConfig)}`);
}

let missingSourceRejected = false;
try {
  createMatiecCompileInputs(config, sourceFiles.slice(0, 1));
} catch (error) {
  missingSourceRejected = error instanceof PlcRuntimeConfigError && /DataLogger/.test(error.message);
}
if (!missingSourceRejected) throw new Error('missing configured IEC source should be rejected');

const collisionConfig = structuredClone(config);
collisionConfig.pous[1].source = 'other/PumpControl.st';
collisionConfig.iecSources[1].source = 'other/PumpControl.st';
let collisionRejected = false;
try {
  createMatiecCompileInputs(collisionConfig, [
    sourceFiles[0],
    { path: 'other/PumpControl.st', content: 'PROGRAM DataLogger\nEND_PROGRAM\n' },
  ]);
} catch (error) {
  collisionRejected = error instanceof PlcRuntimeConfigError && /平铺后文件名冲突/.test(error.message);
}
if (!collisionRejected) throw new Error('flattened source name collision should be rejected');

console.log('plc matiec adapter tests passed');
