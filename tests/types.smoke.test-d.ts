import { CalendarScheduler, resolveSolarJob, getNextRun } from '../src/index.js';

const scheduler = new CalendarScheduler({ timezone: 'Asia/Shanghai' });

scheduler.solar('0 0 9 * * *', () => {});

const lunarJob = scheduler.lunar('0 0 0 1 1 *', () => {});
if (lunarJob.kind === 'lunar') {
  lunarJob.kind satisfies 'lunar';
}

const resolved = resolveSolarJob('0 0 9 * * 1', 'Asia/Shanghai');
if (resolved.kind === 'solar') {
  resolved.cron satisfies string;
}

const next = getNextRun(resolved, new Date());
next satisfies Date | null;

scheduler.stop();

export {};
