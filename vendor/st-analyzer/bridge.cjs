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
// ---- 依赖图 / 影响面(action=graph / impact) ----

// 声明名提取:与上游校验器一致(st-validator.ts:832),
// item.variables 是字符串,nextVariables 是字符串数组。
function declNamesOf(item) {
  const names = [];
  if (!item || typeof item !== 'object') return names;
  if (typeof item.variables === 'string' && item.variables) names.push(item.variables);
  for (const nv of item.nextVariables || []) if (typeof nv === 'string' && nv) names.push(nv);
  if (!names.length && typeof item.name === 'string' && item.name) names.push(item.name);
  return names;
}

// VAR_EXTERNAL 声明块的判定:解析结果落在本文件时,只有来自 VAR_EXTERNAL 块的声明
// 才算"引入全局变量"。用声明所在列表的 CST 文本判定(以 VAR_EXTERNAL 关键字开头),
// 避免同名局部变量产生假边。
function isVarExternalResolution(reference) {
  let node = reference && reference.ref;
  let depth = 0;
  while (node && typeof node === 'object' && depth < 8) {
    if (node.definition === 'VAR_EXTERNAL') return true;
    const cst = node.$cstNode;
    if (cst && typeof cst.text === 'string' && /^\s*VAR_EXTERNAL\b/i.test(cst.text)) return true;
    node = node.$container;
    depth += 1;
  }
  return false;
}

function buildGraphAnalysis(shared, created, request) {
  const options = request.options || {};
  const maxEdges = options.maxEdges || 2000;
  const maxUnresolved = 50;
  const im = shared.workspace.IndexManager;
  const all = im.allElements();
  const arr = all && typeof all.toArray === 'function' ? all.toArray() : Array.from(all || []);

  // uri 字符串 -> 请求里的展示路径
  const keyToPath = new Map(created.map((item) => [item.key, item.requestPath]));
  const nodeSet = new Set(created.map((item) => item.key));

  // 全局变量名 -> 声明它的文件(GVL 依赖补边的基础)
  const globalMap = new Map();
  for (const desc of arr) {
    if (!desc || desc.type !== 'GlobalVarList' || !desc.node) continue;
    const file = keyToPath.get(String(desc.documentUri || '')) || String(desc.documentUri || '');
    for (const item of desc.node.items || []) {
      for (const name of declNamesOf(item)) {
        if (name && !globalMap.has(name)) globalMap.set(name, file);
      }
    }
  }

  const edges = new Map();
  const addEdge = (from, to, symbol, kind) => {
    if (!from || !to || from === to || edges.size >= maxEdges) return;
    const key = from + '||' + to;
    if (!edges.has(key)) edges.set(key, { from, to, symbols: new Set(), kinds: new Set() });
    edges.get(key).symbols.add(symbol);
    edges.get(key).kinds.add(kind);
  };
  const unresolvedMap = new Map();
  let externalCount = 0;
  for (const item of created) {
    const self = item.requestPath;
    for (const r of item.document.references || []) {
      const name = r && r.$refText;
      if (!name) continue;
      const nd = r.$nodeDescription;
      if (nd && nd.documentUri) {
        const target = keyToPath.get(String(nd.documentUri)) || String(nd.documentUri);
        if (target === self) {
          // 本地解析:只有 VAR_EXTERNAL 声明才补 GVL 边(防同名局部变量产生假边)
          const hit = globalMap.get(name);
          if (hit && hit !== self && isVarExternalResolution(r)) addEdge(self, hit, name, 'global');
          continue;
        }
        if (nodeSet.has(String(nd.documentUri))) addEdge(self, target, name, 'reference');
        else externalCount += 1;
        continue;
      }
      // 未解析:名字命中其他文件全局变量时仍记 GVL 边,否则记未解析
      const hit = globalMap.get(name);
      if (hit && hit !== self) addEdge(self, hit, name, 'global');
      else {
        const key = self + '||' + name;
        unresolvedMap.set(key, (unresolvedMap.get(key) || 0) + 1);
      }
    }
  }

  // 循环依赖:互相可达的文件组(简单 SCC:同组内任意两点互相可达)
  const edgeList = [...edges.values()];
  const nodes = [...new Set(edgeList.flatMap((e) => [e.from, e.to]))];
  const adj = new Map();
  for (const e of edgeList) {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    adj.get(e.from).add(e.to);
  }
  const reachableFrom = (start) => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const next of adj.get(cur) || []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    return seen;
  };
  const reach = new Map(nodes.map((n) => [n, reachableFrom(n)]));
  const assigned = new Set();
  const cycles = [];
  for (const n of nodes) {
    if (assigned.has(n)) continue;
    const peers = nodes.filter((m) => m !== n && reach.get(n).has(m) && reach.get(m).has(n));
    if (peers.length) {
      const group = [n, ...peers].sort();
      for (const p of peers) assigned.add(p);
      assigned.add(n);
      cycles.push(group);
    }
  }

  return {
    files: created.map((item) => item.requestPath),
    edges: edgeList.map((e) => ({ from: e.from, to: e.to, symbols: [...e.symbols], kinds: [...e.kinds] })),
    cycles,
    unresolved: [...unresolvedMap.entries()].slice(0, maxUnresolved).map(([key, count]) => {
      const [file, symbol] = key.split('||');
      return { file, symbol, count };
    }),
    unresolvedCount: unresolvedMap.size,
    externalCount,
  };
}



// 影响面 = 反向可达闭包(自算,不依赖 IndexManager.isAffected,实测其语义不符)
function buildImpactAnalysis(graphData, request) {
  const options = request.options || {};
  const target = options.impactTarget;
  const symbols = Array.isArray(options.symbols) && options.symbols.length ? options.symbols : undefined;
  const granularity = options.granularity === 'symbol' || symbols ? 'symbol' : 'file';
  const maxDependents = options.maxDependents || 200;
  const edges = graphData.edges || [];

  const dependents = new Map();
  for (const e of edges) {
    if (!dependents.has(e.to)) dependents.set(e.to, new Set());
    dependents.get(e.to).add(e.from);
  }

  const reverseBfs = (startSet) => {
    const seen = new Set(startSet);
    const queue = [...startSet];
    while (queue.length && seen.size < maxDependents) {
      const cur = queue.shift();
      for (const from of dependents.get(cur) || []) {
        if (from === target || seen.has(from)) continue;
        seen.add(from);
        if (seen.size >= maxDependents) break;
        queue.push(from);
      }
    }
    return seen;
  };

  const direct = new Set();
  for (const e of edges) if (e.to === target) direct.add(e.from);

  const payload = {
    target,
    granularity,
    directDependents: [...direct].slice(0, maxDependents),
    // 闭包不含目标自身(与 directDependents 口径一致:"受影响"指别人,不是自己)
    allDependents: [...reverseBfs([target])].filter((file) => file !== target),
  };

  if (symbols) {
    // 符号级:首跳只保留引用了指定符号的边,之后按文件级传递
    const symbolSet = new Set(symbols);
    const bySymbol = {};
    const firstHop = new Set();
    for (const e of edges) {
      if (e.to !== target) continue;
      for (const symbol of e.symbols) {
        if (!symbolSet.has(symbol)) continue;
        if (!bySymbol[symbol]) bySymbol[symbol] = [];
        if (!bySymbol[symbol].includes(e.from)) bySymbol[symbol].push(e.from);
        firstHop.add(e.from);
      }
    }
    payload.bySymbol = bySymbol;
    payload.directDependents = [...firstHop].slice(0, maxDependents);
    payload.allDependents = [...reverseBfs(firstHop)].filter((file) => file !== target);
  }

  return payload;
}

// ---- 符号引用查询(action=symbol) ----

// 文本偏移 -> 1 起的行列号
function positionOfOffset(text, offset) {
  const head = text.slice(0, offset);
  const lines = head.split('\n');
  return { line: lines.length, character: lines[lines.length - 1].length + 1 };
}

// 从 AstNodeDescription 的 segment 取声明位置(缺失时返回 0,表示未知)
function positionOfSegment(text, segment) {
  if (!text || !segment || typeof segment.offset !== 'number' || segment.offset < 0) {
    return { line: 0, character: 0 };
  }
  return positionOfOffset(text, segment.offset);
}

function toDescriptionArray(streamLike) {
  if (!streamLike) return [];
  if (typeof streamLike.toArray === 'function') return streamLike.toArray();
  return Array.from(streamLike);
}

/**
 * 符号引用查询:回答"这个符号声明在哪、被哪些文件的哪一行引用"。
 *
 * 数据来源与依赖图不同:依赖图走的是跨文件边(edges),
 * 这里走的是 document.references —— 因此能覆盖同一文件内部的本地变量引用,
 * 那是 edges 拿不到的(本地引用不产生跨文件边)。
 *
 * 声明表额外取自 IndexManager,覆盖"声明了但没有任何引用"的符号,
 * 否则这类符号会查不到,被误读成"符号不存在"。
 */
function buildSymbolReferences(shared, created, request) {
  const options = request.options || {};
  const maxReferences = options.maxReferences || 40;
  const maxDeclarations = options.maxDeclarations || 20;
  const symbolName = typeof request.symbol === 'string' ? request.symbol : '';
  const pathFilter = typeof request.path === 'string' ? request.path : '';

  const keyToPath = new Map(created.map((item) => [item.key, item.requestPath]));
  const keyToText = new Map(created.map((item) => [item.key, item.text || '']));

  // 目标声明(uri#path) -> 条目。按"声明节点"聚合而非按名字聚合,同名遮蔽才不会串。
  const targets = new Map();
  const ensureTarget = (uriKey, desc) => {
    const key = uriKey + '#' + String((desc && desc.path) || '');
    if (!targets.has(key)) {
      const text = keyToText.get(uriKey) || '';
      const segment = desc && (desc.selectionSegment || desc.nameSegment);
      const pos = positionOfSegment(text, segment);
      targets.set(key, {
        file: keyToPath.get(uriKey),
        name: String((desc && desc.name) || ''),
        type: String((desc && desc.type) || 'unknown'),
        line: pos.line,
        character: pos.character,
        references: [],
      });
    }
    return targets.get(key);
  };

  // ① 全局索引里的声明:保证"零引用"的符号也能被找到
  for (const desc of toDescriptionArray(shared.workspace.IndexManager.allElements())) {
    if (!desc || desc.name !== symbolName) continue;
    const uriKey = String(desc.documentUri || '');
    if (!keyToPath.has(uriKey)) continue; // 只认本次分析池内的文件
    ensureTarget(uriKey, desc);
  }

  // ② 反向索引:每条引用按目标声明归档,附带使用点行列
  for (const item of created) {
    const text = keyToText.get(item.key) || '';
    for (const r of item.document.references || []) {
      const nd = r && r.$nodeDescription;
      if (!nd || !nd.documentUri || nd.name !== symbolName) continue;
      const uriKey = String(nd.documentUri);
      if (!keyToPath.has(uriKey)) continue; // 指向分析池外(外部库符号)的引用不计
      const entry = ensureTarget(uriKey, nd);
      const offset = r.$refNode ? r.$refNode.offset : -1;
      if (offset < 0) continue;
      const pos = positionOfOffset(text, offset);
      entry.references.push({ file: item.requestPath, line: pos.line, character: pos.character });
    }
  }

  const comparePath = (a, b) => (a === b ? 0 : a < b ? -1 : 1);
  let list = [...targets.values()];
  if (pathFilter) list = list.filter((item) => item.file === pathFilter);
  list.sort((a, b) => comparePath(a.file, b.file) || a.line - b.line);

  let truncated = list.length > maxDeclarations;
  const declarations = list.slice(0, maxDeclarations).map((item) => {
    const refs = item.references
      .sort((a, b) => comparePath(a.file, b.file) || a.line - b.line || a.character - b.character);
    const kept = refs.slice(0, maxReferences);
    if (refs.length > kept.length) truncated = true;
    return {
      file: item.file,
      name: item.name,
      type: item.type,
      line: item.line,
      character: item.character,
      referenceCount: refs.length,
      references: kept,
    };
  });

  return {
    symbol: symbolName,
    declarationCount: list.length,
    declarations,
    truncated,
  };
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
    const text = normalizeText(item.text);
    const document = shared.workspace.LangiumDocumentFactory.fromString(text, uri);
    docs.addDocument(document);
    // text 仅供符号引用查询换算行列号,其余动作不读它
    created.push({ key: uri.toString(), uri, document, requestPath: item.path, text });
    return uri.toString();
  };

  const action = typeof request.action === 'string' && request.action ? request.action : 'validate';
  let exitCode = 0;
  let payload = null;
  try {
    const targets = Array.isArray(request.targets) ? request.targets : [];
    const context = Array.isArray(request.context) ? request.context : [];

    if (action === 'graph' || action === 'impact' || action === 'symbol') {
      // 图/影响面/符号引用三个动作共用同一个构建池(targets 与 context 合并,或由 files 显式给出)
      const pool = Array.isArray(request.files) && request.files.length ? request.files : [...context, ...targets];
      for (const item of pool) addDocument(item);
      await shared.workspace.DocumentBuilder.build(created.map((item) => item.document), { validation: false });
      if (action === 'symbol') {
        const symbolName = typeof request.symbol === 'string' ? request.symbol.trim() : '';
        if (!symbolName) {
          process.stderr.write('symbol action requires a non-empty "symbol" field\n');
          exitCode = 3;
        } else {
          payload = {
            protocolVersion: 1,
            engine: engineInfo(),
            references: buildSymbolReferences(shared, created, request),
            contextLoaded: pool.length,
            elapsedMs: Date.now() - startedAt,
          };
        }
      } else {
        const graph = buildGraphAnalysis(shared, created, request);
        payload = {
          protocolVersion: 1,
          engine: engineInfo(),
          graph,
          contextLoaded: pool.length,
          elapsedMs: Date.now() - startedAt,
        };
        if (action === 'impact') {
          payload.impact = buildImpactAnalysis(graph, request);
        }
      }
    } else if (action === 'validate') {
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
    } else {
      process.stderr.write('unsupported action: ' + action + '\n');
      exitCode = 3;
    }
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
