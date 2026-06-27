#!/usr/bin/env node
/**
 * Scatter 高级用法：minGap、quietHours、预览 slot、list API。
 * 运行：pnpm run example:scatter-advanced
 */
import {
  listScatterSlotsForDay,
  resolveScatterJob,
  scatter,
} from '../dist/index.mjs';

const TZ = 'Asia/Shanghai';
const JOB_ID = 'group-bubble-advanced';

const input = scatter.daily({
  window: { start: '09:00', end: '18:00' },
  count: 3,
  on: 'workday',
  minGapMinutes: 30,
  quietHours: [{ start: '12:00', end: '13:00' }],
  misfire: 'coalesce',
});

const job = resolveScatterJob(input, TZ);
const dateKey = '2024-09-23';

console.log('--- scatter advanced example ---');
console.log('minGapMinutes:', job.minGapMinutes);
console.log('quietHours:', job.quietHours);
console.log('misfire:', job.misfire);
console.log('');
console.log(`Slots on ${dateKey}:`);
for (const slot of listScatterSlotsForDay(job, JOB_ID, dateKey)) {
  console.log(
    ' ',
    slot.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }),
  );
}
