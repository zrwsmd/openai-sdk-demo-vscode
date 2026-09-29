import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runtimeRoot = path.join(repoRoot, 'src', 'runtime');
const sourceRoot = path.join(repoRoot, 'src');
const pluginRoot = path.join(runtimeRoot, 'plugins');
const stPluginRoot = path.join(pluginRoot, 'st');

const staticForbiddenTokens = [
  'stAnalyzer',
  'StAnalyzer',
  'stAnalyzerSettings',
  'StValidation',
  'DeliveryWorkflow',
  'AdaptedWorkflowRuntime',
  'DeliveryWorkflowDescriptor',
  'createDeliveryWorkflowRuntime',
  'adaptDeliveryWorkflow',
  'createDeliveryContract',
  'matchesDeliveryContract',
  'deliveryWorkflow',
  'needs_validate_st_code',
  'inferSt',
  'isStCode',
  'isStWorkspace',
  'isStDelivery',
  'isStInspection',
  'PLC/ST',
  'Structured Text',
];

function ensureTestBundle() {
  const bundlePath = path.join(scriptDir, 'agent.testbundle.mjs');
  if (fs.existsSync(bundlePath)) return bundlePath;
  execFileSync(
    process.execPath,
    [path.join(scriptDir, 'build_test_bundle.mjs')],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  return bundlePath;
}

async function registeredPluginToolNames() {
  const bundlePath = ensureTestBundle();
  const testEntry = await import(`${pathToFileURL(bundlePath).href}?boundary=${Date.now()}`);
  const registry = testEntry.createAppToolRegistry();
  const coreProviderId = testEntry.createCoreToolProvider().id;
  const names = registry
    .list()
    .filter((provider) => provider.id !== coreProviderId)
    .flatMap((provider) =>
      (provider.capabilities ?? [])
        .map((capability) => capability.name)
        .filter((name) => typeof name === 'string' && name.trim()),
    );
  assert(
    names.length > 0,
    'boundary test could not discover any registered plugin tool capabilities',
  );
  return [...new Set(names)];
}

const forbiddenPatterns = [
  /(^|[/\\])runtime[/\\]workflows[/\\]st[A-Z][^'"]*/u,
  /(^|[/\\])runtime[/\\]tools[/\\](?:validateStTool|dependencyTools)\b/u,
  /(^|[/\\])runtime[/\\]pipeline[/\\]stWorkspaceDeliveryPlan\b/u,
  /(^|[/\\])runtime[/\\]stContentHash\b/u,
  /\.(?:st)\b/iu,
];

function listTypeScriptFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (fullPath === pluginRoot || fullPath.startsWith(`${pluginRoot}${path.sep}`)) continue;
    if (entry.isDirectory()) {
      result.push(...listTypeScriptFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

function listAllTypeScriptFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...listAllTypeScriptFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

const files = listTypeScriptFiles(runtimeRoot);
const pluginFiles = listAllTypeScriptFiles(pluginRoot);
const sourceFiles = listTypeScriptFiles(sourceRoot);
const forbiddenTokens = [
  ...staticForbiddenTokens,
  ...(await registeredPluginToolNames()),
];
const nonStPluginForbiddenTokens = [
  'StAnalyzer',
  'stAnalyzer',
  'StAnalyzerSettings',
  'StValidation',
  'DeliveryContract',
  'deliveryContract',
  'DeliveryWorkflow',
  'validate_st_code',
  'export_st_program',
  'st_dependency_map',
  'st_change_impact',
  'st_symbol_references',
  'st_library_symbol',
];
const findings = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  for (const token of forbiddenTokens) {
    if (text.includes(token)) findings.push(`${relative}: forbidden token ${token}`);
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) findings.push(`${relative}: forbidden pattern ${pattern}`);
  }
}

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  if (
    /(?:from|import)\s*(?:\(\s*)?['"][^'"]*(?:runtime[/\\])?plugins[/\\]st(?:[/\\]|['"])/u.test(text)
  ) {
    findings.push(`${relative}: public runtime imports the ST plugin directly`);
  }
}

for (const file of pluginFiles) {
  if (file === stPluginRoot || file.startsWith(`${stPluginRoot}${path.sep}`)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repoRoot, file);
  for (const token of nonStPluginForbiddenTokens) {
    if (text.includes(token)) {
      findings.push(`${relative}: non-ST plugin contains domain token ${token}`);
    }
  }
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (
    text.includes('deliveryCompatibility') ||
    text.includes('src/runtime/deliveryWorkflow') ||
    text.includes('runtime/deliveryWorkflow')
  ) {
    findings.push(`${path.relative(repoRoot, file)}: deleted Delivery compatibility reference`);
  }
}

for (const legacyPath of [
  'src/runtime/workflow/deliveryCompatibility.ts',
  'src/runtime/deliveryWorkflow.ts',
  'src/runtime/workflows/stDeliveryContract.ts',
  'src/runtime/workflows/stInspectionWorkflow.ts',
  'src/runtime/plugins/st/stInspectionWorkflow.ts',
  'src/runtime/workflows/stToolContext.ts',
  'src/runtime/workflows/stToolProvider.ts',
  'src/runtime/workflows/stWorkspaceDeliveryWorkflow.ts',
  'src/runtime/tools/validateStTool.ts',
  'src/runtime/tools/dependencyTools.ts',
  'src/runtime/pipeline/stWorkspaceDeliveryPlan.ts',
  'src/runtime/stContentHash.ts',
]) {
  assert.equal(
    fs.existsSync(path.join(repoRoot, legacyPath)),
    false,
    `legacy compatibility shim still exists: ${legacyPath}`,
  );
}

assert.deepEqual(findings, [], `public runtime boundary violations:\n${findings.join('\n')}`);
assert(
  pluginFiles.some((file) => path.resolve(file) === path.join(stPluginRoot, 'stValidationRuntimeService.ts')),
  'ST validation runtime service must remain inside the ST plugin directory',
);
console.log(
  `runtime boundary passed (${files.length} public TypeScript files scanned; ` +
    `${pluginFiles.length} plugin files and ${sourceFiles.length} source import boundaries checked)`,
);
