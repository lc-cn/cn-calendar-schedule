#!/usr/bin/env node
/**
 * SQLite 持久化（Node.js 22.5+ 内置 node:sqlite，零额外依赖）。
 * 运行：pnpm run example:sqlite-persist
 */
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CalendarScheduler, createSqliteStore } from '../dist/index.mjs';

const tmpDir = join(dirname(fileURLToPath(import.meta.url)), '.tmp');
const dbPath = join(tmpDir, 'jobs.db');

function dailyReport(ctx) {
  console.log('[sqlite]', ctx.jobId, ctx.solarText);
}

await mkdir(tmpDir, { recursive: true });

console.log('--- cn-calendar-schedule sqlite persist example ---');
console.log('db:', dbPath);

const scheduler = await CalendarScheduler.create({
  timezone: 'Asia/Shanghai',
  store: createSqliteStore({ path: dbPath }),
  handlers: { 'daily-report': dailyReport },
});

scheduler.solar('0 0 9 * * *', dailyReport, 'daily-report', { id: 'sqlite-demo' });

console.log('Registered jobs:', scheduler.list().map((job) => job.id));
console.log('nextRunAt:', scheduler.get('sqlite-demo')?.nextRunAt?.toISOString());

scheduler.stop();
await rm(tmpDir, { recursive: true, force: true });
