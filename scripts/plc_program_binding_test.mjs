import {
  extractPlcProgramDeclarations,
  inspectPlcProgramBindings,
  taskProgramBindings,
} from './agent.testbundle.mjs';

const source = `
(* PROGRAM FakeInComment *)
VAR
  label : STRING := 'PROGRAM FakeInString';
END_VAR
// PROGRAM FakeInLineComment
PROGRAM RETAIN MainProgram
END_PROGRAM
PROGRAM Secondary
END_PROGRAM
`;

const declarations = extractPlcProgramDeclarations(source);
if (
  declarations.length !== 2 ||
  declarations[0].name !== 'MainProgram' ||
  declarations[0].line < 5 ||
  declarations[1].name !== 'Secondary'
) {
  throw new Error(`PROGRAM 识别错误: ${JSON.stringify(declarations)}`);
}

const config = {
  schemaVersion: 2,
  tasks: [
          {
            name: 'MainTask',
            deviceId: 'plc',
            type: 'cyclic',
            periodMs: 20,
            priority: 1,
            cpuCore: 0,
            instances: [{ name: 'instance_Main', pou: 'MainProgram' }],
          },
          {
            name: 'SecondaryTask',
            deviceId: 'plc',
            type: 'cyclic',
            periodMs: 100,
            priority: 2,
            cpuCore: 0,
            instances: [{ name: 'instance_Secondary', pou: 'Secondary' }],
          },
  ],
  pous: [
    { name: 'MainProgram', pouType: 'program', source: 'src/MainProgram.st' },
    { name: 'Secondary', pouType: 'program', source: 'src/Secondary.st' },
  ],
  devices: [{ id: 'plc', role: 'local', model: 'PLC', points: [], connections: [] }],
  networks: [],
  ioMappings: [],
};

let inspection = inspectPlcProgramBindings(config, {
  source: 'src/MainProgram.st',
  text: source,
});
if (
  inspection.resolutions[0]?.status !== 'bound' ||
  inspection.resolutions[0]?.matches[0]?.taskName !== 'MainTask'
) {
  throw new Error('唯一程序绑定没有被识别');
}
if (inspection.resolutions[1]?.status !== 'source_mismatch') {
  throw new Error('源文件不一致没有被识别');
}

inspection = inspectPlcProgramBindings(config, {
  source: 'src/New.st',
  text: 'PROGRAM NewProgram\nEND_PROGRAM',
});
if (inspection.resolutions[0]?.status !== 'unbound') {
  throw new Error('未绑定程序没有被识别');
}

const duplicated = structuredClone(config);
duplicated.pous[1].source = 'src/MainProgram.st';
duplicated.tasks[0].instances.push({ name: 'instance_SecondaryDuplicate', pou: 'Secondary' });
inspection = inspectPlcProgramBindings(duplicated, {
  source: 'src/MainProgram.st',
  text: 'PROGRAM Secondary\nEND_PROGRAM',
});
if (inspection.resolutions[0]?.status !== 'ambiguous') {
  throw new Error('多任务重复绑定没有被识别');
}

const taskBindings = taskProgramBindings(config, 'MainTask');
if (taskBindings.length !== 1 || taskBindings[0].instance.name !== 'instance_Main') {
  throw new Error('任务程序绑定查询失败');
}

console.log('plc program binding tests passed');
