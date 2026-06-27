#!/usr/bin/env node
/**
 * 持久化：任务配置写入 JSON，handler 通过 key 在重启后注入。
 * 运行：pnpm run example:persist
 */
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CalendarScheduler, createLocalJsonStore } from '../dist/index.mjs';

const tmpDir = join(dirname(fileURLToPath(import.meta.url)), '.tmp');
const storePath = join(tmpDir, 'jobs.json');

function dailyReport(ctx) {
  console.log('handler fired:', ctx.solarText, ctx.lunarText);
}

await mkdir(tmpDir, { recursive: true });

console.log('--- cn-calendar-schedule persist example ---');

const scheduler1 = await CalendarScheduler.create({
  timezone: 'Asia/Shanghai',
  store: createLocalJsonStore({ path: storePath }),
});

scheduler1.solar('0 0 9 * * *', dailyReport, 'daily-report', { id: 'demo-daily' });

await new Promise((resolve) => setTimeout(resolve, 50));

const payload = JSON.parse(await readFile(storePath, 'utf8'));
console.log('\nPersisted job (无 handler 函数体，仅有 handlerKey):');
console.log(JSON.stringify(payload, null, 2));

scheduler1.stop();

const scheduler2 = await CalendarScheduler.create({
  timezone: 'Asia/Shanghai',
  store: createLocalJsonStore({ path: storePath }),
  handlers: { 'daily-report': dailyReport },
});

console.log('\nRestarted scheduler; restored job id:', payload.jobs[0]?.id);
console.log('handler 已通过 handlers["daily-report"] 重新注入，到点可触发。');

scheduler2.stop();
await rm(tmpDir, { recursive: true, force: true });
