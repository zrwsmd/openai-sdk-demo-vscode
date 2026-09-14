const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const originalLoader = Module._extensions['.js'];
const nodeModulesMarker = `${path.sep}node_modules${path.sep}`;

Module._extensions['.js'] = function loadThirdPartyJavaScript(module, filename) {
  if (!filename.includes(nodeModulesMarker)) {
    return originalLoader(module, filename);
  }

  const source = fs.readFileSync(filename, 'utf8');
  const withoutSourceMap = source.replace(
    /\r?\n\/\/# sourceMappingURL=.*?(?=\r?\n|$)/g,
    '',
  );
  module._compile(withoutSourceMap, filename);
};
