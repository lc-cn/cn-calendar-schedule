#!/usr/bin/env node
/**
 * 基础用法：注册任务并打印下次触发时间（不等待真实定时）。
 * 运行：pnpm run example:basic
 */
import {
  CalendarScheduler,
  cron,
  getNextRun,
  resolveFreeDayJob,
  resolveHolidayJob,
  resolveSolarJob,
  resolveWorkdayJob,
} from '../dist/index.mjs';

const TZ = 'Asia/Shanghai';
const CALENDAR_CRON = cron.at(9);
const from = new Date();

function fmt(date) {
  return date?.toLocaleString('zh-CN', { timeZone: TZ, hour12: false }) ?? '(none)';
}

function onTrigger(ctx) {
  const festival = ctx.festival ? ` · ${ctx.festival}` : '';
  console.log(`[${ctx.kind}] ${ctx.solarText} · ${ctx.lunarText}${festival}`);
}

const scheduler = new CalendarScheduler({ timezone: TZ });

scheduler.solar(cron.at(9, 0, { dayOfWeek: 1 }), onTrigger, 'weekly-report');
scheduler.workday(CALENDAR_CRON, onTrigger, 'workday-reminder');
scheduler.freeDay(CALENDAR_CRON, onTrigger, 'weekend-reminder');
scheduler.holiday(
  { cron: CALENDAR_CRON, festivals: ['国庆节'] },
  onTrigger,
  'national-day',
);

console.log('--- cn-calendar-schedule basic example ---');
console.log('From:', fmt(from));
console.log('');
console.log('Next run:');
console.log('  solar (Mon 09:00) ', fmt(getNextRun(resolveSolarJob(cron.at(9, 0, { dayOfWeek: 1 }), TZ), from)));
console.log('  workday           ', fmt(getNextRun(resolveWorkdayJob(CALENDAR_CRON, TZ), from)));
console.log('  freeDay           ', fmt(getNextRun(resolveFreeDayJob(CALENDAR_CRON, TZ), from)));
console.log(
  '  holiday (国庆)    ',
  fmt(getNextRun(resolveHolidayJob({ cron: CALENDAR_CRON, festivals: ['国庆节'] }, TZ), from)),
);
console.log('');
console.log('Handlers registered:', scheduler.handlers.has('weekly-report') && scheduler.handlers.has('workday-reminder'));

scheduler.stop();
