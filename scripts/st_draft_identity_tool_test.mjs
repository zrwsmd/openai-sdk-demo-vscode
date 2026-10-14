import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  StValidationRuntimeService,
  StWorkspaceDeliveryWorkflow,
  ToolRegistry,
  createCoreToolProvider,
  createStCodeDeliveryContract,
  createStToolProvider,
  createStValidationState,
} from './agent.testbundle.mjs';

async function withSession(run) {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'st-delivery-ws-'));
  const exportDir = await fs.mkdtemp(path.join(os.tmpdir(), 'st-delivery-export-'));
  try {
    const contract = createStCodeDeliveryContract({
      workspacePersistence: 'required',
    });
    const service = new StValidationRuntimeService(createStValidationState());
    const workflow = new StWorkspaceDeliveryWorkflow(contract, service);
    const tools = new ToolRegistry([
      createCoreToolProvider(),
      createStToolProvider(),
    ]).createTools({
      cfg: {
        baseUrl: 'http://localhost/v1',
        apiKey: 'test',
        model: 'test',
        exportDir,
        workspaceRoot,
        workspaceRoots: [workspaceRoot],
      },
      userText: '生成 ST 程序并保存到工作区',
      workflowContract: contract,
      workflow,
    });
    const findTool = (name) => {
      const found = tools.find((tool) => tool.name === name);
      assert(found, `missing tool: ${name}`);
      return found;
    };
    const invoke = async (name, input) =>
      JSON.parse(await findTool(name).invoke({}, JSON.stringify(input)));
    const fileExists = async (relativePath) =>
      fs.access(path.join(workspaceRoot, relativePath)).then(
        () => true,
        () => false,
      );
    await run({ invoke, service, workspaceRoot, fileExists });
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(exportDir, { recursive: true, force: true });
  }
}

const candidates = [
  {
    label: 'FUNCTION_BLOCK',
    first: 'FUNCTION_BLOCK MotorControl\nEND_FUNCTION_BLOCK',
    second: 'FUNCTION_BLOCK PressureControl\nEND_FUNCTION_BLOCK',
    path: 'PressureControl.st',
    name: 'PRESSURECONTROL',
  },
  {
    label: 'FUNCTION',
    first: 'FUNCTION Scale : REAL\nEND_FUNCTION',
    second: 'FUNCTION Normalize : REAL\nEND_FUNCTION',
    path: 'Normalize.st',
    name: 'NORMALIZE',
  },
  {
    label: 'TYPE',
    first: 'TYPE\n  PressureValue : REAL;\nEND_TYPE',
    second: 'TYPE\n  PressureLimit : REAL;\nEND_TYPE',
    path: 'PressureLimit.st',
    name: 'PRESSURELIMIT',
  },
];

for (const item of candidates) {
  await withSession(async ({ invoke, service, fileExists }) => {
    const first = await invoke('validate_st_code', { code: item.first });
    const second = await invoke('validate_st_code', { code: item.second });
    assert.equal(first.ok, true, `${item.label} 第一个候选应能校验`);
    assert.equal(second.ok, true, `${item.label} 第二个候选应能校验`);
    assert.equal(
      service.state.draftIdentity,
      undefined,
      `${item.label} 校验候选不应锁定交付声明`,
    );

    const hash = second.data.validatedContentHash;
    const writeBeforeCommit = await invoke('write_file', {
      path: item.path,
      content: item.second,
    });
    assert.equal(writeBeforeCommit.ok, false, `${item.label} 未授权写入应被阻止`);
    assert.equal(
      writeBeforeCommit.diagnostics?.some(
        (diagnostic) => diagnostic.code === 'st_delivery_authorization_required',
      ),
      true,
      `${item.label} 应返回正式交付授权诊断`,
    );
    assert.equal(await fileExists(item.path), false, `${item.label} 未授权不得落盘`);

    const authorization = await invoke('commit_st_delivery', {
      path: item.path,
      contentHash: hash,
    });
    assert.equal(authorization.ok, true, `${item.label} 应登记最终交付候选`);
    assert(authorization.data.deliveryAuthorization);
    assert.equal(authorization.data.deliveryAuthorization.contentHash, hash);

    const persisted = await invoke('write_file', {
      path: item.path,
      content: item.second,
    });
    assert.equal(persisted.ok, true, `${item.label} 授权后应能写入`);
    assert.equal(persisted.data.stPersistence?.contentHash, hash);
    assert(persisted.data.deliveryCommit, `${item.label} 应由写入回执生成正式 commit`);
    assert.equal(await fileExists(item.path), true);
    assert.equal(
      service.state.draftIdentity?.declaration.name,
      item.name,
      `${item.label} 只有正式 commit 后才锁定声明`,
    );
  });
}

await withSession(async ({ invoke, service, fileExists }) => {
  const probe = 'PROGRAM Probe5\nEND_PROGRAM\n';
  const official = 'PROGRAM PressureFilterScale\nEND_PROGRAM\n';
  const probeValidation = await invoke('validate_st_code', { code: probe });
  const officialValidation = await invoke('validate_st_code', { code: official });
  assert.equal(probeValidation.ok, true, 'Probe 候选本身可以在内存中校验');
  assert.equal(officialValidation.ok, true, '正式候选本身可以在内存中校验');
  assert.equal(service.state.draftIdentity, undefined, '校验 Probe 不应锁死正式目标');

  const probeWrite = await invoke('write_file', {
    path: 'Probe5.st',
    content: probe,
  });
  assert.equal(probeWrite.ok, false, '未被选中的 Probe 不得写入');
  assert.equal(await fileExists('Probe5.st'), false, 'Probe 不得落盘');

  // PROGRAM 写入会进入 PLC 任务组态流程；这里验证它在授权门前就被拦截，
  // 不触发组态弹窗或配置文件写入。
  const officialWrite = await invoke('write_file', {
    path: 'PressureFilterScale.st',
    content: official,
  });
  assert.equal(officialWrite.ok, false, '正式候选在授权前也不得直接写入');
  assert.equal(await fileExists('PressureFilterScale.st'), false);
});

console.log('st delivery authorization tests passed');
