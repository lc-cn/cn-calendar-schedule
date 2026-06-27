#!/usr/bin/env node
/**
 * 调度器运维：list / pause / resume / expiresAt / next-runs 预览。
 * 运行：pnpm run example:scheduler-ops
 */
import { CalendarScheduler, resolveWorkdayJob, simulateNextRuns } from '../dist/index.mjs';

const TZ = 'Asia/Shanghai';

console.log('--- scheduler ops example ---');

const scheduler = new CalendarScheduler({ timezone: TZ });

function ping(ctx) {
  console.log('fired', ctx.jobId, ctx.solarText);
}

scheduler.workday('0 0 9 * * *', ping, 'morning', {
  id: 'ops-morning',
  expiresAt: '2025-12-31T15:59:59.000Z',
});
scheduler.scatter(
  { window: { start: '10:00', end: '18:00' }, count: 2, on: 'workday' },
  ping,
  'bubble',
  { id: 'ops-bubble' },
);

console.log('\nRegistered:');
for (const snap of scheduler.list()) {
  console.log(
    ` - ${snap.id} kind=${snap.kind} paused=${snap.paused ?? false} next=${snap.nextRunAt?.toISOString() ?? 'null'}`,
  );
}

scheduler.pause('ops-bubble');
console.log('\nAfter pause ops-bubble:', scheduler.get('ops-bubble')?.paused);

scheduler.resume('ops-bubble');
console.log('After resume ops-bubble:', scheduler.get('ops-bubble')?.paused);

const workdayJob = resolveWorkdayJob('0 0 9 * * *', TZ);
const preview = simulateNextRuns(workdayJob, 3, { from: new Date('2024-09-23T08:00:00+08:00') });
console.log('\nNext 3 workday 09:00 runs (simulate):');
for (const run of preview) {
  console.log(' ', run.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }));
}

scheduler.stop();
