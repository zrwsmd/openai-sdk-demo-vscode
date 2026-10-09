import type {
  PlcProgramBinding,
  PlcRuntimeConfig,
  PlcTaskConfig,
} from './plcRuntimeConfig';

export interface PlcProgramDeclaration {
  type: 'program';
  name: string;
  line: number;
  character: number;
}

export interface PlcProgramBindingMatch {
  resourceName: string;
  taskName: string;
  binding: PlcProgramBinding;
}

export type PlcProgramBindingStatus =
  | 'bound'
  | 'unbound'
  | 'ambiguous'
  | 'source_mismatch';

export interface PlcProgramBindingResolution {
  declaration: PlcProgramDeclaration;
  status: PlcProgramBindingStatus;
  matches: PlcProgramBindingMatch[];
  typeMatches: PlcProgramBindingMatch[];
}

export interface PlcProgramBindingInspection {
  source: string;
  declarations: PlcProgramDeclaration[];
  resolutions: PlcProgramBindingResolution[];
}

function normalizeSource(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function sourceKey(value: string): string {
  return normalizeSource(value).toLocaleLowerCase();
}

function nameKey(value: string): string {
  return value.toLocaleUpperCase();
}

/**
 * Masks comments and string literals while preserving offsets and newlines.
 * This keeps declaration line/column locations usable without pretending to
 * be a complete IEC parser.
 */
function maskNonCode(text: string): string {
  const chars = Array.from(text);
  let state: 'code' | 'lineComment' | 'blockComment' | 'string' = 'code';
  let blockDepth = 0;
  let quote = '';

  const blank = (index: number): void => {
    if (chars[index] !== '\r' && chars[index] !== '\n') chars[index] = ' ';
  };

  for (let index = 0; index < chars.length; index += 1) {
    const current = chars[index];
    const next = chars[index + 1] ?? '';

    if (state === 'lineComment') {
      if (current === '\n' || current === '\r') state = 'code';
      else blank(index);
      continue;
    }

    if (state === 'blockComment') {
      if (current === '(' && next === '*') {
        blank(index);
        blank(index + 1);
        blockDepth += 1;
        index += 1;
        continue;
      }
      if (current === '*' && next === ')') {
        blank(index);
        blank(index + 1);
        blockDepth -= 1;
        index += 1;
        if (blockDepth <= 0) state = 'code';
        continue;
      }
      blank(index);
      continue;
    }

    if (state === 'string') {
      if (current === quote && next === quote) {
        blank(index);
        blank(index + 1);
        index += 1;
        continue;
      }
      if (current === quote) {
        blank(index);
        state = 'code';
      } else {
        blank(index);
      }
      continue;
    }

    if (current === '/' && next === '/') {
      blank(index);
      blank(index + 1);
      index += 1;
      state = 'lineComment';
      continue;
    }
    if (current === '(' && next === '*') {
      blank(index);
      blank(index + 1);
      index += 1;
      blockDepth = 1;
      state = 'blockComment';
      continue;
    }
    if (current === "'" || current === '"') {
      quote = current;
      blank(index);
      state = 'string';
    }
  }
  return chars.join('');
}

function lineAndCharacter(text: string, offset: number): { line: number; character: number } {
  const before = text.slice(0, offset);
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  return {
    line: before.split(/\r?\n/u).length,
    character: offset - lineStart,
  };
}

export function extractPlcProgramDeclarations(text: string): PlcProgramDeclaration[] {
  const masked = maskNonCode(text);
  const declarations: PlcProgramDeclaration[] = [];
  const declarationPattern =
    /\bPROGRAM\s+(?:(?:RETAIN|NON_RETAIN)\s+)?([A-Za-z_][A-Za-z0-9_]*)/giu;
  for (const match of masked.matchAll(declarationPattern)) {
    const name = match[1];
    const offset = match.index + match[0].toUpperCase().indexOf('PROGRAM');
    const location = lineAndCharacter(text, offset);
    declarations.push({
      type: 'program',
      name,
      line: location.line,
      character: location.character,
    });
  }
  return declarations;
}

function allProgramBindings(config: PlcRuntimeConfig): PlcProgramBindingMatch[] {
  const matches: PlcProgramBindingMatch[] = [];
  for (const resource of config.configuration.resources) {
    for (const task of resource.tasks) {
      for (const binding of task.programs) {
        matches.push({
          resourceName: resource.name,
          taskName: task.name,
          binding,
        });
      }
    }
  }
  return matches;
}

function matchingBindings(
  bindings: readonly PlcProgramBindingMatch[],
  declaration: PlcProgramDeclaration,
  source: string,
): { typeMatches: PlcProgramBindingMatch[]; matches: PlcProgramBindingMatch[] } {
  const typeMatches = bindings.filter(
    (item) => nameKey(item.binding.typeName) === nameKey(declaration.name),
  );
  const currentSource = sourceKey(source);
  const matches = typeMatches.filter(
    (item) => sourceKey(item.binding.source) === currentSource,
  );
  return { typeMatches, matches };
}

export function inspectPlcProgramBindings(
  config: PlcRuntimeConfig,
  input: { source: string; text: string },
): PlcProgramBindingInspection {
  const source = normalizeSource(input.source);
  const bindings = allProgramBindings(config);
  const declarations = extractPlcProgramDeclarations(input.text);
  const resolutions = declarations.map((declaration) => {
    const { typeMatches, matches } = matchingBindings(bindings, declaration, source);
    let status: PlcProgramBindingStatus;
    if (matches.length === 1) status = 'bound';
    else if (matches.length > 1) status = 'ambiguous';
    else if (typeMatches.length > 0) status = 'source_mismatch';
    else status = 'unbound';
    return { declaration, status, matches, typeMatches };
  });
  return { source, declarations, resolutions };
}

export function taskProgramBindings(
  config: PlcRuntimeConfig,
  taskName: string,
): PlcProgramBindingMatch[] {
  const result: PlcProgramBindingMatch[] = [];
  for (const resource of config.configuration.resources) {
    for (const task of resource.tasks) {
      if (task.name !== taskName) continue;
      for (const binding of task.programs) {
        result.push({
          resourceName: resource.name,
          taskName: task.name,
          binding,
        });
      }
    }
  }
  return result;
}

export function findPlcTask(
  config: PlcRuntimeConfig,
  taskName: string,
): { resourceName: string; task: PlcTaskConfig } | undefined {
  for (const resource of config.configuration.resources) {
    const task = resource.tasks.find((candidate) => candidate.name === taskName);
    if (task) return { resourceName: resource.name, task };
  }
  return undefined;
}

