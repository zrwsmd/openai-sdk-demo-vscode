import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/test_entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['vscode'],
  target: 'node18',
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  outfile: 'scripts/agent.testbundle.mjs',
});

console.log('test bundle generated');
