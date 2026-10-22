/**
 * 澄清弹窗里"自定义输入"的校验规则。
 *
 * 这里放的是最终判定，前端 media/main.js 里有一份等价实现，只负责边打字边提示。
 * 两份必须保持一致：前端漏掉的，这里还会挡一次；前端多挡的，用户会发现明明能填却提交不了。
 */

/** Windows 不允许出现在文件名里的字符。冒号单独判，盘符要用。 */
const WINDOWS_INVALID_NAME_CHARS = /[<>:"/\\|?*]/u;
const WINDOWS_INVALID_PATH_CHARS = /[<>"|?*]/u;
/** 控制字符（含换行、制表符）。 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/u;
/** Windows 设备保留名，带不带扩展名都不能用。 */
const RESERVED_DEVICE_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export const PROJECT_NAME_MAX_LENGTH = 100;

/**
 * 工程名校验。返回 undefined 表示通过，否则返回可以直接展示给用户的原因。
 *
 * 工程名会被直接当作目录名用（<父目录>\<工程名>），所以规则跟 Windows 建目录一致：
 * 不能用非法字符、不能是设备保留名、不能以点或空格结尾，也不能靠 ".." 往上跳。
 */
export function checkProjectName(value: string): string | undefined {
  const raw = String(value ?? '');
  const name = raw.trim();
  if (!name) return '不能为空';
  // 不做静默 trim：名字会直接当目录名用，悄悄改掉和建出一个带空格的目录都不对。
  if (name !== raw) return '首尾不能有空格';
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    return `不能超过 ${PROJECT_NAME_MAX_LENGTH} 个字符`;
  }
  if (CONTROL_CHARS.test(name)) return '不能包含换行或控制字符';
  if (WINDOWS_INVALID_NAME_CHARS.test(name)) {
    return '不能包含 < > : " / \\ | ? * 这些字符';
  }
  if (name === '.' || name === '..') return '不能是 . 或 ..';
  if (name.startsWith('.')) return '不能以点开头';
  if (name.endsWith('.')) return '不能以点结尾';
  const base = name.split('.')[0]?.toUpperCase() ?? name.toUpperCase();
  if (RESERVED_DEVICE_NAMES.has(base)) {
    return `不能使用系统保留名 ${base}`;
  }
  return undefined;
}

/**
 * 工程父目录校验。只看格式，不碰磁盘：前端拿不到文件系统，存在性由调用方判断。
 * 要求绝对路径，因为相对路径落在哪个盘取决于 IDE 的当前目录，用户预期对不上。
 */
export function checkDirectoryPath(value: string): string | undefined {
  const raw = String(value ?? '');
  const target = raw.trim();
  if (!target) return '不能为空';
  if (target !== raw) return '首尾不能有空格';
  if (CONTROL_CHARS.test(target)) return '不能包含换行或控制字符';
  if (WINDOWS_INVALID_PATH_CHARS.test(target)) {
    return '不能包含 < > " | ? * 这些字符';
  }
  // 盘符绝对路径：C:\ 或 C:/，也可以只写 C:
  if (/^[A-Za-z]:(?:[\\/]|$)/u.test(target)) return undefined;
  // UNC：\\server\share
  if (/^\\\\[^\\/]+[\\/][^\\/]+/u.test(target)) return undefined;
  return '必须是绝对路径，例如 E:\\projects';
}
