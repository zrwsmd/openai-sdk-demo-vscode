import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PLC_RUNTIME_CONFIG_FILE_NAME,
  PlcRuntimeConfigError,
  auditPlcRuntimeConfigWorkspace,
  createInitialPlcRuntimeConfigDraft,
  writePlcRuntimeConfig,
} from './agent.testbundle.mjs';

function issueCodes(report) {
  return report.issues.map((issue) => issue.code).sort();
}

{
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-audit-missing-'));
  const report = await auditPlcRuntimeConfigWorkspace({
    workspaceRoot: workspace,
    files: [
      { source: 'src/Pump.st', content: 'PROGRAM Pump\nEND_PROGRAM\n' },
      { source: 'src/Main.st', content: 'PROGRAM Main\nEND_PROGRAM\n' },
    ],
  });
  if (
    report.configState !== 'missing' ||
    report.summary.programCount !== 2 ||
    !issueCodes(report).includes('config_missing')
  ) {
    throw new Error('missing config workspace was not reported correctly');
  }
}

{
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-audit-ready-'));
  await writePlcRuntimeConfig(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME), {
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
          cpuCore: 0,
          programs: [{
            instanceName: 'instance_Pump',
            typeName: 'Pump',
            source: 'src/Pump.st',
          }],
        }],
      }],
    },
  });
  const report = await auditPlcRuntimeConfigWorkspace({
    workspaceRoot: workspace,
    files: [{ source: 'src/Pump.st', content: 'PROGRAM Pump\nEND_PROGRAM\n' }],
  });
  if (
    report.configState !== 'ready' ||
    report.summary.configuredProgramCount !== 1 ||
    report.summary.issueCount !== 0
  ) {
    throw new Error(`valid configured workspace reported issues: ${issueCodes(report).join(',')}`);
  }
}

{
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-audit-mismatch-'));
  await writePlcRuntimeConfig(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME), {
    schemaVersion: 1,
    configuration: {
      name: 'CONFIG_IEC',
      resources: [{
        name: 'resource_MainTask',
        target: 'PLC',
        tasks: [
          {
            name: 'MainTask',
            type: 'cyclic',
            periodMs: 100,
            priority: 1,
            cpuCore: 0,
            programs: [{
              instanceName: 'instance_Missing',
              typeName: 'Missing',
              source: 'src/Missing.st',
            }],
          },
          {
            name: 'EventTask',
            type: 'event',
            priority: 2,
            cpuCore: 1,
            trigger: { kind: 'variable', ref: 'Alarm', edge: 'rising' },
            programs: [{
              instanceName: 'instance_Event',
              typeName: 'EventProgram',
              source: 'src/EventProgram.st',
            }],
          },
        ],
      }],
    },
  });
  const report = await auditPlcRuntimeConfigWorkspace({
    workspaceRoot: workspace,
    files: [
      { source: 'src/Actual.st', content: 'PROGRAM Missing\nEND_PROGRAM\n' },
      { source: 'src/EventProgram.st', content: 'PROGRAM Other\nEND_PROGRAM\n' },
    ],
  });
  const codes = issueCodes(report);
  for (const expected of [
    'program_source_mismatch',
    'program_unbound',
    'binding_source_missing',
    'binding_type_missing',
    'event_task_runtime_only',
  ]) {
    if (!codes.includes(expected)) {
      throw new Error(`expected audit issue ${expected}, got ${codes.join(',')}`);
    }
  }
  if (report.summary.errorCount < 2 || report.summary.warningCount < 2) {
    throw new Error('audit summary did not count errors and warnings');
  }
}

{
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-runtime-audit-invalid-'));
  await fs.writeFile(path.join(workspace, PLC_RUNTIME_CONFIG_FILE_NAME), '{ broken', 'utf8');
  const report = await auditPlcRuntimeConfigWorkspace({
    workspaceRoot: workspace,
    files: [{ source: 'src/Pump.st', content: 'PROGRAM Pump\nEND_PROGRAM\n' }],
  });
  if (report.configState !== 'invalid' || !issueCodes(report).includes('config_invalid')) {
    throw new Error('invalid config was not reported');
  }
}

{
  const draft = createInitialPlcRuntimeConfigDraft({
    periodMs: 50,
    programs: [
      { source: 'src/Pump.st', programName: 'Pump' },
      { source: 'src/Pump2.st', programName: 'Pump' },
    ],
  });
  const programs = draft.configuration.resources[0].tasks[0].programs;
  if (
    draft.configuration.resources[0].tasks[0].periodMs !== 50 ||
    programs[0].instanceName !== 'instance_Pump' ||
    programs[1].instanceName !== 'instance_Pump_2'
  ) {
    throw new Error('initial draft did not create stable task bindings');
  }
}

{
  let rejected = false;
  try {
    createInitialPlcRuntimeConfigDraft({
      periodMs: 0,
      programs: [{ source: 'src/Pump.st', programName: 'Pump' }],
    });
  } catch (error) {
    rejected = error instanceof PlcRuntimeConfigError && /periodMs/.test(error.message);
  }
  if (!rejected) throw new Error('initial draft accepted an invalid period');
}

console.log('plc runtime audit tests passed');
