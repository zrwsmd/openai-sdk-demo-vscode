import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runtimeRoot = path.join(repoRoot, 'src', 'runtime');
const pluginRoot = path.join(runtimeRoot, 'plugins');

const forbiddenTokens = [
  'validate_st_code',
  'export_st_program',
  'st_dependency_map',
  'st_change_impact',
  'st_symbol_references',
  'stAnalyzer',
  'StAnalyzer',
  'stAnalyzerSettings',
  'StValidation',
  'needs_validate_st_code',
  'inferSt',
  'isStCode',
  'isStWorkspace',
  'isStDelivery',
  'isStInspection',
  'PLC/ST',
  'Structured Text',
];

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

const files = listTypeScriptFiles(runtimeRoot);
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

for (const legacyPath of [
  'src/runtime/workflows/stDeliveryContract.ts',
  'src/runtime/workflows/stInspectionWorkflow.ts',
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
console.log(`runtime boundary passed (${files.length} public TypeScript files scanned)`);
