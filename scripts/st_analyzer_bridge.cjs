'use strict';
/**
 * ST 校验桥(vendor 内运行,零依赖)。
 *
 * 契约:stdin 一行 JSON 进,stdout 一行 JSON 出;退出码 0=成功 / 2=不可用 / 3=协议错 / 4=内部异常。
 * 设计要点:
 *  1. 必须在 require 校验器之前劫持 console,否则 Chevrotain 的语法歧义警告会污染 stdout;
 *  2. 不依赖 vscode-uri,自己构造 file:// URI(Windows-only);
 *  3. 只把文本折成内存文档,不读盘、不写盘,因此不需要审批;
 *  4. 诊断码映射留给上层(analysis/stDiagnosticCodes),这里只透传原始信息。
 */
const fs = require('node:fs');
const path = require('node:path');

const startedAt = Date.now();
const emit = console.log.bind(console);
// ① 噪声隔离
for (const level of ['log', 'info', 'warn', 'debug']) {
  console[level] = (...args) => process.stderr.write('[' + level + '] ' + args.map(String).join(' ') + '\n');
}

const BUNDLE_PATH = path.join(__dirname, 'main.cjs');
const VENDOR_META_PATH = path.join(__dirname, 'vendor.json');

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (raw += chunk));
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

// ② 零依赖 URI(Windows file:// 形态)
function makeUri(fsPath) {
  const normalized = String(fsPath).replace(/\\/g, '/');
  const pathPart = normalized.startsWith('/') ? normalized : '/' + normalized;
  const doc = { scheme: 'file', authority: '', path: pathPart, query: '', fragment: '' };
  return Object.assign({}, doc, {
    fsPath: String(fsPath),
    toString: () => 'file://' + pathPart,
    toJSON: () => doc,
    with: () => makeUri(fsPath),
  });
}

const SEVERITY_BY_LSP = { 1: 'error', 2: 'warning', 3: 'info', 4: 'info' };

function resolveAbsolutePath(rootPath, itemPath) {
  return /^[A-Za-z]:[\\/]/.test(itemPath) ? itemPath : path.join(rootPath, itemPath);
}

function engineInfo() {
  const info = { id: 'st-analyze', bundle: BUNDLE_PATH, nodeVersion: process.version };
  try {
    info.bundleMtime = fs.statSync(BUNDLE_PATH).mtime.toISOString();
  } catch {
    /* ignore */
  }
  try {
    info.dataJsonPresent = fs.existsSync(path.join(__dirname, 'data.json'));
  } catch {
    /* ignore */
  }
  try {
    const meta = JSON.parse(fs.readFileSync(VENDOR_META_PATH, 'utf8'));
    if (meta && typeof meta.sourceCommit === 'string' && meta.sourceCommit) {
      info.sourceCommit = meta.sourceCommit;
    }
  } catch {
    /* vendor.json 可选 */
  }
  return info;
}

(async () => {
  let request;
  try {
    request = JSON.parse((await readStdin()).trim());
  } catch (error) {
    emit(JSON.stringify({ protocolVersion: 1, error: 'bad_request', message: String(error) }));
    process.exit(3);
  }

  let shared;
  let st;
  try {
    ({ shared, st } = require(BUNDLE_PATH));
  } catch (error) {
    process.stderr.write('analyzer unavailable: ' + ((error && error.stack) || error) + '\n');
    process.exit(2);
  }

  const docs = shared.workspace.LangiumDocuments;
  const workspaceRoot = typeof request.workspaceRoot === 'string' ? request.workspaceRoot : '';
  const maxDiagnostics = (request.options && request.options.maxDiagnostics) || 200;
  const normalizeText = (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n');
  const created = [];

  const addDocument = (item) => {
    const uri = makeUri(resolveAbsolutePath(workspaceRoot, item.path));
    if (docs.hasDocument(uri)) docs.deleteDocument(uri);
    const document = shared.workspace.LangiumDocumentFactory.fromString(normalizeText(item.text), uri);
    docs.addDocument(document);
    created.push({ key: uri.toString(), uri, document });
    return uri.toString();
  };

  let exitCode = 0;
  let payload = null;
  try {
    const targets = Array.isArray(request.targets) ? request.targets : [];
    const context = Array.isArray(request.context) ? request.context : [];
    for (const item of context) addDocument(item);
    const targetKeys = targets.map(addDocument);

    // 校验由我们显式调用,build 阶段不再重复跑
    await shared.workspace.DocumentBuilder.build(created.map((item) => item.document), { validation: false });

    const results = [];
    for (let index = 0; index < targets.length; index += 1) {
      const record = created.find((item) => item.key === targetKeys[index]);
      const raw = await st.validation.DocumentValidator.validateDocument(record.document);
      const mapped = raw.map((diagnostic) => ({
        severity: SEVERITY_BY_LSP[diagnostic.severity] || 'error',
        rawCode: diagnostic.code == null ? null : diagnostic.code,
        message: String(diagnostic.message || '').replace(/\s+/g, ' ').slice(0, 500),
        line: diagnostic.range.start.line + 1,
        character: diagnostic.range.start.character + 1,
        endLine: diagnostic.range.end.line + 1,
        endCharacter: diagnostic.range.end.character + 1,
        source: diagnostic.source,
      }));
      const limited = mapped.slice(0, maxDiagnostics);
      results.push({
        path: targets[index].path,
        errorCount: limited.filter((item) => item.severity === 'error').length,
        warningCount: limited.filter((item) => item.severity === 'warning').length,
        infoCount: limited.filter((item) => item.severity === 'info').length,
        truncated: mapped.length > limited.length,
        diagnostics: limited,
      });
    }

    payload = {
      protocolVersion: 1,
      engine: engineInfo(),
      results,
      contextLoaded: context.length,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    process.stderr.write('validate failed: ' + ((error && error.stack) || error) + '\n');
    exitCode = 4;
  } finally {
    for (const item of created) {
      if (docs.hasDocument(item.uri)) docs.deleteDocument(item.uri);
    }
  }

  if (payload) emit(JSON.stringify(payload));
  // 显式退出:main.cjs 里挂了 LSP 监听,不主动退会吊住进程
  process.exit(exitCode);
})();
