import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEVUNI_COMMANDS,
  DEVUNI_COMMAND_PORT_SERVICE,
  WorkflowDecisionService,
  WorkflowRegistry,
  ToolRegistry,
  createAppToolRegistry,
  createDevuniToolProvider,
} from './agent.testbundle.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/* ------------------------------------------------------------------ */
/* [1] 声明表 → 能力表,风险与工具名必须一致                            */
/* ------------------------------------------------------------------ */

const names = DEVUNI_COMMANDS.map((command) => command.toolName);
assert(names.length >= 2, `devuni 命令表为空或过短: ${JSON.stringify(names)}`);

const provider = createDevuniToolProvider();
assert(
  provider.capabilities.length === DEVUNI_COMMANDS.length,
  '能力表数量与声明表不一致,新接口可能会"工具加了但路由看不见"',
);

const isolated = new ToolRegistry([provider]);
assert(
  isolated.getRisk('devuni_create_project') === 'write',
  'devuni_create_project 风险应为 write(会走审批)',
);
assert(
  isolated.getRisk('devuni_project_options') === 'read',
  'devuni_project_options 风险应为 read(只读,不进审批)',
);

/* ------------------------------------------------------------------ */
/* [2] 路由:普通提问能把这几个工具选出来                                */
/* ------------------------------------------------------------------ */

const appRegistry = createAppToolRegistry();
const catalog = appRegistry.getToolCatalog();

const fallbackService = new WorkflowDecisionService(
  () => {},
  undefined,
  new WorkflowRegistry(),
  catalog,
);
const fallbackConfig = {
  baseUrl: '',
  apiKey: 'test',
  model: 'test',
  exportDir: '',
  workspaceRoot: '',
  jev: { enabled: false },
};
const forCreateDecision = await fallbackService.decide(
  fallbackConfig,
  '帮我在 E 盘创建一个工程',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'fallback',
      mode: 'file_edit',
      confidence: 0.9,
      reason: 'create project fallback visibility',
    }),
  },
);
const forCreate = forCreateDecision.allowedTools ?? [];
assert(
  forCreate.includes('devuni_create_project'),
  `file_edit 候选里没有 devuni_create_project: ${forCreate.join('|')}`,
);

const forOptionsDecision = await fallbackService.decide(
  fallbackConfig,
  '支持哪些设备型号和工程语言',
  undefined,
  [],
  {
    modelClassifier: async () => ({
      kind: 'fallback',
      mode: 'read_only',
      confidence: 0.9,
      reason: 'project options fallback visibility',
    }),
  },
);
const forOptions = forOptionsDecision.allowedTools ?? [];
assert(
  forOptions.includes('devuni_project_options'),
  `read_only 候选里没有 devuni_project_options: ${forOptions.join('|')}`,
);

/* ------------------------------------------------------------------ */
/* [3] 参数翻译与返回翻译                                              */
/* ------------------------------------------------------------------ */

const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'devuni-command-test-'));

const initInfoReply = {
  status: true,
  initInfo: {
    languages: [{ id: 'st', name: '结构化文本(ST)' }],
    machineList: [{ id: 'SC5100', name: 'SC5100' }],
    projectType: ['standard', 'HMI'],
  },
};

function makePort(handler) {
  const calls = [];
  const port = {
    async invoke(command, args) {
      calls.push({ command, args });
      return handler(command, args);
    },
  };
  return { port, calls };
}

async function buildTool(port) {
  const registry = new ToolRegistry([createDevuniToolProvider()]);
  const tools = registry.createTools({
    cfg: {
      apiKey: 'test',
      model: 'test',
      workspaceRoot: workspace,
      workspaceRoots: [workspace],
      services: new Map([[DEVUNI_COMMAND_PORT_SERVICE, port]]),
    },
  });
  const tool = tools.find((candidate) => candidate.name === 'devuni_create_project');
  assert(!!tool, 'devuni_create_project 工具没有被注册出来');
  return tool;
}

// [3a] 给出必填的机型但省略语言/类型:应先问可选项,再建工程,且默认不切窗口
{
  const { port, calls } = makePort((command) => {
    if (command === 'bridgeProjectInitInfo') return initInfoReply;
    if (command === 'bridgeCreateProject') {
      return { status: true, wsUri: 'e:\\demo\\demo.code-workspace' };
    }
    throw new Error(`unexpected command ${command}`);
  });
  const tool = await buildTool(port);
  const raw = await tool.invoke(
    {},
    JSON.stringify({
      projectName: 'demo',
      projectPath: 'E:\\',
      deviceModel: 'SC5100',
    }),
    {},
  );
  const result = JSON.parse(raw);

  assert(result.ok === true, `创建工程应成功: ${raw}`);
  assert(result.risk === 'write', `risk 应为 write: ${raw}`);
  assert(result.effect === 'filesystem', `effect 应为 filesystem: ${raw}`);

  assert(calls.length === 2, `应先查可选项再建工程,实际调用 ${calls.length} 次`);
  assert(
    calls[0].command === 'bridgeProjectInitInfo',
    `第一次应查可选项,实际 ${calls[0].command}`,
  );
  const createArgs = calls[1].args;
  assert(calls[1].command === 'bridgeCreateProject', '第二次应调用建工程命令');
  assert(createArgs.deviceModel === 'SC5100', `设备型号不对: ${JSON.stringify(createArgs)}`);
  assert(createArgs.lan === 'st', `language 应翻译成 lan: ${JSON.stringify(createArgs)}`);
  assert(createArgs.prjType === 'standard', `默认工程类型不对: ${JSON.stringify(createArgs)}`);
  assert(
    createArgs.openAfterCreate === false,
    '默认必须不切窗口,否则会重启扩展宿主并中断当前会话',
  );
}

// [3b] 三项都给全:不该再跨插件问一次可选项
{
  const { port, calls } = makePort((command) => {
    if (command === 'bridgeCreateProject') return { status: true, wsUri: 'e:\\x\\x.code-workspace' };
    throw new Error(`不该调用 ${command}`);
  });
  const tool = await buildTool(port);
  const raw = await tool.invoke(
    {},
    JSON.stringify({
      projectName: 'x',
      projectPath: 'E:\\',
      deviceModel: 'SC5100',
      language: 'st',
      projectType: 'standard',
      openAfterCreate: true,
    }),
    {},
  );
  const result = JSON.parse(raw);
  assert(result.ok === true, `创建工程应成功: ${raw}`);
  assert(
    !('workspaceFile' in (result.data ?? {})),
    `工具结果不能暴露 .code-workspace 路径: ${raw}`,
  );
  assert(calls.length === 1, `参数齐全时只应调用一次,实际 ${calls.length} 次`);
  assert(
    calls[0].args.openAfterCreate === false,
    '即使旧调用方传 true，创建命令也必须等待整轮完成后由宿主打开新窗口',
  );
}

// [3c] 创建工程只负责交接；同一 run 的相对路径仍使用原工作区
{
  const originalRoot = path.join(workspace, 'original-workspace');
  const createdRoot = path.join(workspace, 'created-project', 'SC5100');
  const workspaceFile = path.join(workspace, 'created-project', 'demo.code-workspace');
  await fs.mkdir(originalRoot, { recursive: true });
  await fs.mkdir(createdRoot, { recursive: true });
  await fs.writeFile(
    workspaceFile,
    JSON.stringify({ folders: [{ path: 'SC5100' }] }),
    'utf8',
  );
  const { port } = makePort((command) => {
    if (command === 'bridgeCreateProject') return { status: true, wsUri: workspaceFile };
    throw new Error(`不该调用 ${command}`);
  });
  const tools = createAppToolRegistry().createTools({
    cfg: {
      apiKey: 'test',
      model: 'test',
      workspaceRoot: originalRoot,
      workspaceRoots: [originalRoot],
      services: new Map([[DEVUNI_COMMAND_PORT_SERVICE, port]]),
    },
  });
  const createTool = tools.find((candidate) => candidate.name === 'devuni_create_project');
  const writeTool = tools.find((candidate) => candidate.name === 'write_file');
  assert(!!createTool && !!writeTool, '创建工程或写文件工具没有注册');
  const createRaw = await createTool.invoke(
    {},
    JSON.stringify({
      projectName: 'demo',
      projectPath: path.dirname(path.dirname(createdRoot)),
      deviceModel: 'SC5100',
      language: 'st',
      projectType: 'standard',
    }),
    {},
  );
  const createResult = JSON.parse(createRaw);
  assert(createResult.ok === true, `创建工程应成功: ${createRaw}`);
  assert(
    !('workspaceFile' in (createResult.data ?? {})),
    `工具结果不能暴露 .code-workspace 路径: ${createRaw}`,
  );
  const writeRaw = await writeTool.invoke(
    {},
    JSON.stringify({ path: 'same-run.txt', content: 'original workspace' }),
    {},
  );
  assert(JSON.parse(writeRaw).ok === true, `相对写入应成功: ${writeRaw}`);
  assert(
    await fs.readFile(path.join(originalRoot, 'same-run.txt'), 'utf8') === 'original workspace',
    '创建工程后不应改变当前 run 的首选工作区',
  );
  const leakedIntoNewProject = await fs
    .access(path.join(createdRoot, 'same-run.txt'))
    .then(() => true, () => false);
  assert(!leakedIntoNewProject, '旧窗口同一 run 的相对写入不应落入新工程');
}

// [3d] 对方返回 status:false 时,必须变成 ok:false 并带上排查提示
{
  const { port } = makePort((command) => {
    if (command === 'bridgeProjectInitInfo') return initInfoReply;
    return { status: false };
  });
  const tool = await buildTool(port);
  const raw = await tool.invoke(
    {},
    JSON.stringify({
      projectName: 'demo',
      projectPath: 'E:\\',
      deviceModel: 'SC5100',
    }),
    {},
  );
  const result = JSON.parse(raw);
  assert(result.ok === false, `失败必须转成 ok:false: ${raw}`);
  assert(
    typeof result.error === 'string' && result.error.includes('创建工程失败'),
    `失败信息应说明原因: ${raw}`,
  );
}

// [3e] 拿不到可选项且语言/类型没给全:应当直接报错,不要继续创建
{
  const { port, calls } = makePort(() => ({ status: false }));
  const tool = await buildTool(port);
  const raw = await tool.invoke(
    {},
    JSON.stringify({
      projectName: 'demo',
      projectPath: 'E:\\',
      deviceModel: 'SC5100',
    }),
    {},
  );
  const result = JSON.parse(raw);
  assert(result.ok === false, `拿不到可选项时应失败: ${raw}`);
  assert(
    !calls.some((call) => call.command === 'bridgeCreateProject'),
    '拿不到可选项时不该继续调用建工程命令',
  );
}

// [3f] 没有注入命令端口时,应给出明确提示而不是抛异常
{
  const registry = new ToolRegistry([createDevuniToolProvider()]);
  const tools = registry.createTools({
    cfg: {
      apiKey: 'test',
      model: 'test',
      workspaceRoot: workspace,
      workspaceRoots: [workspace],
    },
  });
  const tool = tools.find((candidate) => candidate.name === 'devuni_project_options');
  const raw = await tool.invoke({}, '{}', {});
  const result = JSON.parse(raw);
  assert(result.ok === false, `缺少端口时应失败: ${raw}`);
  assert(
    typeof result.error === 'string' && result.error.includes('命令端口'),
    `缺少端口时应说明通道不可用: ${raw}`,
  );
}

await fs.rm(workspace, { recursive: true, force: true });

console.log('devuni command tests passed');
