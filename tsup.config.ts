import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  globalName: 'CnCalendarSchedule',
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  outExtension({ format }) {
    return {
      js:
        format === 'cjs'
          ? '.cjs'
          : format === 'esm'
            ? '.mjs'
            : '.umd.js',
    };
  },
});
