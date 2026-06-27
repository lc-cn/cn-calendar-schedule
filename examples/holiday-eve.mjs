#!/usr/bin/env node
/**
 * 节前提醒 + scatter holidayEve：日历 helper 与 scatter 过滤器组合。
 * 运行：pnpm run example:holiday-eve
 */
import {
  isHolidayEve,
  isDaysAfterHoliday,
  listScatterSlotsForDay,
  resolveScatterJob,
  scatter,
  simulateNextRuns,
} from '../dist/index.mjs';

const TZ = 'Asia/Shanghai';

console.log('--- holiday eve / after holiday example ---');

const eve = at('2024-09-30T09:00:00+08:00');
console.log('2024-09-30 is 国庆 eve?', isHolidayEve(eve, ['国庆节'], 1, TZ));

const after = at('2024-10-08T09:00:00+08:00');
console.log('2024-10-08 is day after 国庆?', isDaysAfterHoliday(after, ['国庆节'], 1, TZ));

const eveJob = resolveScatterJob(
  scatter.daily({
    window: { start: '09:00', end: '18:00' },
    count: 2,
    on: { kind: 'holidayEve', festivals: ['国庆节'], daysBefore: 1 },
  }),
  TZ,
);

console.log('\nScatter slots on 2024-09-30:');
for (const slot of listScatterSlotsForDay(eveJob, 'eve-bot', '2024-09-30')) {
  console.log(' ', slot.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }));
}

const runs = simulateNextRuns(eveJob, 3, {
  jobId: 'eve-bot',
  from: at('2024-09-01T08:00:00+08:00'),
});
console.log('\nNext 3 eve scatter runs:');
for (const run of runs) {
  console.log(' ', run.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }));
}

function at(iso) {
  return new Date(iso);
}
