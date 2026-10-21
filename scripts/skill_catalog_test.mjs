import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createCoreToolProvider,
  discoverSkillCatalog,
  renderSkillCatalogPrompt,
  ToolRegistry,
} from './agent.testbundle.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-agent-skills-'));
const projectSkills = path.join(root, 'workspace', '.agents', 'skills');
const userSkills = path.join(root, 'user-skills');
const writeSkill = async (base, name, frontmatter, body) => {
  const directory = path.join(base, name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
  return directory;
};

try {
  await writeSkill(projectSkills, 'st-review', 'name: st-review\ndescription: Review IEC ST programs', 'Use the ST review checklist.');
  await writeSkill(userSkills, 'st-review', 'name: st-review\ndescription: User version', 'This must lose to the project skill.');
  await writeSkill(userSkills, 'json-review', 'name: json-review\ndescription: >\n  Check JSON structure\n  and required fields', 'Validate JSON carefully.');
  await writeSkill(userSkills, 'bad_name', 'name: bad_name\ndescription: invalid folder name', 'ignored');
  const reference = path.join(userSkills, 'json-review', 'references', 'schema.md');
  await fs.mkdir(path.dirname(reference), { recursive: true });
  await fs.writeFile(reference, '# JSON schema reference\n', 'utf8');

  const catalog = await discoverSkillCatalog({
    workspaceRoot: path.join(root, 'workspace'),
    userSkillsRoot: userSkills,
  });
  if (catalog.skills.length !== 2) throw new Error(`expected two valid skills, found ${catalog.skills.length}`);
  if (catalog.get('st-review')?.scope !== 'project') throw new Error('project skill must override same-name user skill');
  if (!(await catalog.load('st-review')).includes('ST review checklist')) throw new Error('did not load skill instructions');
  if (!(await catalog.load('json-review', 'references/schema.md')).includes('schema reference')) {
    throw new Error('did not load a skill reference file');
  }
  let traversalRejected = false;
  try {
    await catalog.load('json-review', '../outside.txt');
  } catch (error) {
    traversalRejected = /不能离开技能目录/.test(error.message);
  }
  if (!traversalRejected) throw new Error('skill path traversal was not rejected');
  const prompt = renderSkillCatalogPrompt(catalog);
  if (!prompt.includes('json-review') || !prompt.includes('Check JSON structure') || prompt.includes('Validate JSON carefully')) {
    throw new Error('catalog prompt should contain metadata but not full skill instructions');
  }
  const disabled = await discoverSkillCatalog({ workspaceRoot: path.join(root, 'workspace'), userSkillsRoot: userSkills, enabled: false });
  if (disabled.skills.length !== 0) throw new Error('disabled skill catalog should be empty');
  const cfg = {
    baseUrl: '',
    apiKey: '',
    model: 'test-model',
    exportDir: root,
    workspaceRoot: path.join(root, 'workspace'),
    skillsEnabled: true,
  };
  const registry = new ToolRegistry([createCoreToolProvider()]);
  const namesWithSkills = registry.createTools({ cfg, skillCatalog: catalog }).map((tool) => tool.name);
  const namesWithoutSkills = registry.createTools({ cfg, skillCatalog: disabled }).map((tool) => tool.name);
  if (!namesWithSkills.includes('load_skill') || namesWithoutSkills.includes('load_skill')) {
    throw new Error('load_skill should only be exposed when the run has discovered skills');
  }
  const loaded = await catalog.load('json-review');
  if (!loaded.includes('只能通过 load_skill 工具读取') || !loaded.includes('file=<技能目录内相对路径>')) {
    throw new Error('SKILL.md load result should tell the model to keep using load_skill for skill resources');
  }
  if (!catalog.findByPath(reference) || !catalog.isSkillPath(reference)) {
    throw new Error('skill catalog should recognize its own resource paths');
  }
  const created = registry.createTools({ cfg, skillCatalog: catalog });
  const readFile = created.find((tool) => tool.name === 'read_file');
  if (!readFile) throw new Error('read_file was not created');
  let redirected = false;
  const result = JSON.parse(await readFile.invoke({}, JSON.stringify({ path: reference })));
  const text = JSON.stringify(result);
  redirected = result.ok === false &&
    /属于 Agent Skill json-review/.test(result.error ?? '') &&
    /load_skill/.test(result.error ?? '') &&
    /不需要加入本轮授权/.test(result.error ?? '') &&
    /file="references\/schema.md"/.test(result.error ?? '');
  if (!redirected) {
    throw new Error(`workspace tools should redirect skill paths to load_skill, got ${text}`);
  }

  // 描述总量超过目录提示词上限时,只能砍描述,不能砍技能:名字是 load_skill 唯一的入口。
  const many = Array.from({ length: 60 }, (_, index) => ({
    name: `skill-${index}`,
    description: 'x'.repeat(400),
    scope: 'user',
  }));
  const fatCatalog = {
    skills: many,
    get: () => undefined,
    findByPath: () => undefined,
    isSkillPath: () => false,
    load: async () => '',
  };
  const fatPrompt = renderSkillCatalogPrompt(fatCatalog);
  if (fatPrompt.length > 12000) {
    throw new Error(`catalog prompt exceeded its budget: ${fatPrompt.length}`);
  }
  // 必须解析 JSON 再比对:用 includes 判断名字会被子串骗到,skill-1 能命中 skill-10。
  const catalogEntries = (fatPrompt.match(/\[\{"name":[\s\S]*?\}\]/g) ?? []).flatMap((block) => JSON.parse(block));
  const renderedNames = new Set(catalogEntries.map((entry) => entry.name));
  const droppedNames = many.filter((skill) => !renderedNames.has(skill.name));
  if (droppedNames.length) {
    throw new Error(`catalog prompt dropped ${droppedNames.length} skill names, e.g. ${droppedNames[0].name}`);
  }
  if (catalogEntries.length !== many.length) {
    throw new Error(`catalog prompt listed ${catalogEntries.length} entries for ${many.length} skills`);
  }
  if (!fatPrompt.includes('其余技能只列名称')) {
    throw new Error('over-budget catalog should keep the remaining skills as name-only entries');
  }
  console.log('[skills] over-budget catalog keeps every skill name and stays within budget: passed');

  // 一条超长描述不能把后面较短的描述一起挡掉(continue 而不是 break)。
  const skewed = [
    { name: 'oversized-one', description: 'y'.repeat(11900), scope: 'user' },
    ...Array.from({ length: 5 }, (_, index) => ({
      name: `small-${index}`,
      description: 'short description',
      scope: 'user',
    })),
  ];
  const skewedPrompt = renderSkillCatalogPrompt({
    skills: skewed,
    get: () => undefined,
    findByPath: () => undefined,
    isSkillPath: () => false,
    load: async () => '',
  });
  const skewedEntries = (skewedPrompt.match(/\[\{"name":[\s\S]*?\}\]/g) ?? []).flatMap((block) => JSON.parse(block));
  const described = skewedEntries.filter((entry) => typeof entry.description === 'string');
  if (!described.some((entry) => entry.name === 'small-0')) {
    throw new Error('an oversized description should not block shorter descriptions that still fit');
  }
  if (described.some((entry) => entry.name === 'oversized-one')) {
    throw new Error('the oversized description should fall back to a name-only entry');
  }
  if (!skewedEntries.some((entry) => entry.name === 'oversized-one')) {
    throw new Error('the oversized skill must still be listed by name');
  }
  console.log('[skills] oversized description falls back alone without blocking later entries: passed');
  console.log('[skills] discovery, precedence, lazy loading, resource boundary, prompt metadata and disable flag: passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
