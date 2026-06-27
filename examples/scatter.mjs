#!/usr/bin/env node
/**
 * Scatter 随机调度：工作日 09:00–22:00 内每天确定性随机 3 次。
 * 运行：pnpm run example:scatter
 */
import {
  CalendarScheduler,
  getNextRun,
  resolveScatterJob,
  scatter,
} from '../dist/index.mjs';

const TZ = 'Asia/Shanghai';
const JOB_ID = 'group-bubble-demo';

function fmt(date) {
  return date?.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }) ?? '(none)';
}

const input = scatter.daily({
  window: { start: '09:00', end: '22:00' },
  count: 3,
  on: 'workday',
});

const resolved = resolveScatterJob(input, TZ);
const from = new Date('2024-09-23T08:00:00+08:00');

console.log('--- cn-calendar-schedule scatter example ---');
console.log('From:', fmt(from));
console.log('');
console.log('Today\'s 3 bubble times (deterministic for jobId + date):');
for (let i = 0; i < 3; i++) {
  const state = { dateKey: '2024-09-23', firedCount: i };
  const next = getNextRun(resolved, from, { jobId: JOB_ID, scatterState: state });
  console.log(`  #${i + 1}`, fmt(next));
}

const handler = (ctx) => {
  console.log(`[bubble ${ctx.scatterIndex}/${ctx.scatterCount}] ${ctx.solarText}`);
};

const scheduler = new CalendarScheduler({ timezone: TZ });
scheduler.scatter(input, handler, 'group-bubble', { id: JOB_ID });

console.log('');
console.log('Registered:', scheduler.handlers.has('group-bubble'));
console.log('Next run:', fmt(getNextRun(resolved, from, { jobId: JOB_ID })));

scheduler.stop();
