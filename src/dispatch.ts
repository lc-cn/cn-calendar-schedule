import type { ResolvedJob } from './types.js';
import { getSolarNextRun, isSolarDue } from './resolvers/solar.js';
import { getLunarNextRun, isLunarDue } from './resolvers/lunar.js';
import { getHolidayNextRun, isHolidayDue } from './resolvers/holiday.js';
import { getFreeDayNextRun, isFreeDayDue } from './resolvers/freeDay.js';
import { getWorkdayNextRun, isWorkdayDue } from './resolvers/workday.js';

export function getNextRun(job: ResolvedJob, from: Date = new Date()): Date | null {
  switch (job.kind) {
    case 'solar':
      return getSolarNextRun(from, job.cron, job.timezone);
    case 'lunar':
      return getLunarNextRun(from, job.cron, job.timezone);
    case 'holiday':
      return getHolidayNextRun(from, job);
    case 'freeDay':
      return getFreeDayNextRun(from, job);
    case 'workday':
      return getWorkdayNextRun(from, job);
    default:
      return null;
  }
}

export function isJobDue(job: ResolvedJob, at: Date): boolean {
  switch (job.kind) {
    case 'solar':
      return isSolarDue(at, job.cron, job.timezone);
    case 'lunar':
      return isLunarDue(at, job.cron, job.timezone);
    case 'holiday':
      return isHolidayDue(at, job);
    case 'freeDay':
      return isFreeDayDue(at, job);
    case 'workday':
      return isWorkdayDue(at, job);
    default:
      return false;
  }
}
