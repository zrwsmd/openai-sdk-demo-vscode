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
  console.log('[skills] discovery, precedence, lazy loading, resource boundary, prompt metadata and disable flag: passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
