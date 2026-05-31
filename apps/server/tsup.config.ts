import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  // Bundle the workspace shared package (it ships TS source) into the output.
  noExternal: ['@ctb/shared'],
});
